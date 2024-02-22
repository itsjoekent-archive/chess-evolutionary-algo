import { cpus } from 'node:os';
import {
  Worker,
  workerData,
  isMainThread,
  parentPort,
} from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { Storage } from '@google-cloud/storage';
import {
  System,
  InstructionSet,
} from '@chess-evolutionary-algo/pattern-engine';

const __filename = fileURLToPath(import.meta.url);

const bucketName = process.env.STORAGE_BUCKET as string;
if (!bucketName) {
  throw new Error('STORAGE_BUCKET not defined');
}

const machineName = process.env.MACHINE_NAME as string;
if (!machineName) {
  throw new Error('MACHINE_NAME not defined');
}

const loggerName = `runner-${machineName}-${workerData?.threadId || 'alpha'}`;
const log = (msg: string) =>
  isMainThread
    ? console.log(`${loggerName} - ${msg}`)
    : parentPort!.postMessage(`${loggerName} - ${msg}`);

const storage = new Storage();

const threadIds = [
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliett',
  'kilo',
  'lima',
  'mike',
  'november',
];

async function loadTopPlayers(fromMachineId: string, fromThreadId: string) {
  const data = await storage
    .bucket(bucketName)
    .file(`tournaments/${fromMachineId}/${fromThreadId}/latest`)
    .download();
  const { players } = JSON.parse(data.toString());
  return players as InstructionSet[];
}

async function getRandomTopPlayers() {
  const [files] = await storage
    .bucket(bucketName)
    .getFiles({ prefix: 'tournament/' });
  const randomFile = files[Math.floor(Math.random() * files.length)];
  const data = await randomFile.download();
  const { players } = JSON.parse(data.toString());
  return players as InstructionSet[];
}

async function uploadFile(key: string, data: any) {
  try {
    await storage.bucket(bucketName).file(key).save(JSON.stringify(data), {
      contentType: 'application/json',
    });
  } catch (error) {
    console.log(error);
  }
}

async function main(threadId: string) {
  let uploads: Parameters<typeof uploadFile>[] = [];

  let tournamentCount = 0;
  let existingPlayers: Record<string, InstructionSet> = {};

  log(`loading prior top players ...`);

  try {
    const topPlayers = await loadTopPlayers(machineName, threadId);
    existingPlayers[topPlayers[0].id] = topPlayers[0];
    existingPlayers[topPlayers[1].id] = topPlayers[1];
    log(`loaded top players => ${topPlayers.map((p) => p.id).join(', ')}`);
  } catch (error) {}

  const system = new System({ players: existingPlayers });

  system.subscribe('started_game', () => {
    log(`game started ...`);
  });

  system.subscribe('game_ended', (event) => {
    log(
      `game ended => fen: "${event.payload.fen}", winning score: ${event.payload.winningFitnessScore}, losing score: ${event.payload.losingFitnessScore}, winning player: "${event.payload.winner}", losing player: "${event.payload.loser}"`,
    );

    uploads.push([`games/${event.payload.id}`, event.payload]);
  });

  system.subscribe('tournament_ended', (event) => {
    const {
      payload: { outcome, players },
    } = event;

    const playerFitnessScores = Object.keys(outcome).sort(
      (a, b) => outcome[b] - outcome[a],
    );

    const topPlayers = [
      Object.assign({}, players[playerFitnessScores[0]]),
      Object.assign({}, players[playerFitnessScores[1]]),
    ];

    uploads.push([
      `tournaments/${machineName}/${threadId}/latest`,
      { players: topPlayers },
    ]);

    Object.keys(players).forEach((id) => {
      uploads.push([`players/${id}`, players[id]]);
    });
  });

  async function run() {
    log(`running tournament ...`);
    const result = system.startTournament();
    system.evolvePlayers(result);

    if (tournamentCount > 0 && tournamentCount % 10 === 0) {
      const topPlayers = await getRandomTopPlayers();
      log(`migrating top players => ${topPlayers.map((p) => p.id).join(', ')}`);
      system.migration(topPlayers);
    }

    if (uploads.length) {
      for (const [key, data] of uploads) {
        log(`uploading file => ${key}`);
        await uploadFile(key, data);
      }
      uploads = [];
    }

    tournamentCount++;
    setTimeout(run, 0);
  }

  log(`setting up tournament ...`);
  system.setupTournament(4);
  run();
}

function startWorker(threadId: string) {
  const worker = new Worker(__filename, {
    workerData: { threadId },
  });

  worker.on('error', (error) => {
    log(`worker exit => error: ${error}`);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      log(`worker exit => code: ${code}`);
    }

    startWorker(threadId);
  });

  worker.on('message', (message) => {
    console.log(message);
  });
}

process.on('unhandledRejection', (error: any) => {
  console.error(error?.message);
  process.exitCode = 1;
});

await storage.getServiceAccount();

if (isMainThread) {
  const workers = cpus().length - 1;
  log(`spawning ${workers} workers ...`);
  for (let i = 0; i < workers; i++) {
    startWorker(threadIds[i + 1]);
  }

  setTimeout(() => main(threadIds[0]), 1000);
} else {
  main(workerData.threadId);
}
