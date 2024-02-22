import { cpus } from 'node:os';
import { Worker, workerData, isMainThread } from 'node:worker_threads';
import { Storage } from '@google-cloud/storage';
import {
  System,
  InstructionSet,
} from '@chess-evolutionary-algo/pattern-engine';

const bucket = process.env.STORAGE_BUCKET as string;
if (!bucket) {
  throw new Error('STORAGE_BUCKET not defined');
}

const machineName = process.env.MACHINE_NAME as string;
if (!machineName) {
  throw new Error('MACHINE_NAME not defined');
}

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
];

async function loadTopPlayers(fromMachineId: string, fromThreadId: string) {
  const data = await storage
    .bucket(bucket)
    .file(`tournaments/${fromMachineId}/${fromThreadId}/latest.json`)
    .download();
  const { players } = JSON.parse(data.toString());
  return players as InstructionSet[];
}

async function getRandomTopPlayers() {
  const [files] = await storage
    .bucket(bucket)
    .getFiles({ prefix: 'tournament/' });
  const randomFile = files[Math.floor(Math.random() * files.length)];
  const data = await randomFile.download();
  const { players } = JSON.parse(data.toString());
  return players as InstructionSet[];
}

async function main(threadId: string) {
  let tournamentCount = 0;
  let existingPlayers: Record<string, InstructionSet> = {};

  try {
    const topPlayers = await loadTopPlayers(machineName, threadId);
    existingPlayers[topPlayers[0].id] = topPlayers[0];
    existingPlayers[topPlayers[1].id] = topPlayers[1];
  } catch (error) {}

  const system = new System({ players: existingPlayers });

  system.subscribe('spawned', (event) => {
    storage
      .bucket(bucket)
      .file(`players/${event.payload.instructionSet.id}.json`)
      .save(JSON.stringify(event.payload));
  });

  system.subscribe('started_game', () => {
    console.log(`[game started] ...`);
  });

  system.subscribe('game_ended', (event) => {
    console.log(
      `[game ended] fen: "${event.payload.fen}", winning score: ${event.payload.winningFitnessScore}, losing score: ${event.payload.losingFitnessScore}, winning player: "${event.payload.winner}", losing player: "${event.payload.loser}"`,
    );

    storage
      .bucket(bucket)
      .file(`games/${event.payload.id}.json`)
      .save(JSON.stringify(event.payload));
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

    storage
      .bucket(bucket)
      .file(`tournaments/${machineName}/${threadId}/latest.json`)
      .save(JSON.stringify({ players: topPlayers }));
  });

  async function run() {
    const result = system.startTournament();
    system.evolvePlayers(result);

    if (tournamentCount > 0 && tournamentCount % 10 === 0) {
      const topPlayers = await getRandomTopPlayers();
      console.log(
        `[migrating top players] ${topPlayers.map((p) => p.id).join(', ')}`,
      );
      system.migration(topPlayers);
    }

    tournamentCount++;
    run();
  }

  system.setupTournament();
  run();
}

function startWorker(threadId: string) {
  const worker = new Worker(__filename, {
    workerData: { threadId },
  });

  worker.on('error', (error) => {
    console.log(`[worker exit] (${threadId}) error: ${error}`);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[worker exit] (${threadId}) code: ${code}`);
    }

    startWorker(threadId);
  });
}

if (isMainThread) {
  for (let i = 0; i < cpus().length; i++) {
    startWorker(threadIds[i]);
  }
} else {
  main(workerData.threadId);
}
