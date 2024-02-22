import { Chess } from 'chess.js';
import EventEmitter from 'eventemitter3';
import { v4 as uuid } from 'uuid';
import * as EngineUtils from './utils';
import * as ChessHelpers from './chess-helpers';

export type Column = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Row = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${Column}${Row}`;

export type Color = 'w' | 'b';

export type Piece = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type PatternSquareState = `${Color}${Piece}` | 'c' | 'e' | 'f';

export type AbsolutePatternLocation = `!${Square}`;

type RelativePatternRange = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
type RelativePatternOperation = '+' | '-';
type RelativePatternRangedOperation =
  `${RelativePatternOperation}${RelativePatternRange}`;

type RelativePatternStart = 'f' | 't';

type RelativePatternLocationExclusion =
  | `%f${RelativePatternOperation}0${RelativePatternOperation}0`
  | `%t${RelativePatternOperation}0${RelativePatternOperation}0`;

export type RelativePatternLocation = Exclude<
  `%${RelativePatternStart}${RelativePatternRangedOperation}${RelativePatternRangedOperation}`,
  RelativePatternLocationExclusion
>;

export type PatternLocation = AbsolutePatternLocation | RelativePatternLocation;

export type PatternSegment = `${PatternLocation}=${PatternSquareState}`;

export type Pattern = PatternSegment[];

export type Move = {
  from: Square;
  to: Square;
  promotion?: Piece;
};

export type Instruction = {
  id: string;
  pattern: Pattern;
  move: Move;
  rank: number;
};

export type InstructionSet = {
  id: string;
  instructions: Instruction[];
  generation: number;
  parents?: [InstructionSet['id'], InstructionSet['id']];
};

export type Game = {
  id: string;
  players: [InstructionSet['id'], InstructionSet['id']];
};

export type TournamentOutcome = Record<InstructionSet['id'], number>;

export type EngineEvent<EventName extends string, EventType> = {
  type: EventName;
  payload: EventType;
};

export type EngineEvents = {
  tournament_started: EngineEvent<
    'tournament_started',
    {
      tournamentSize: number;
      players: Record<InstructionSet['id'], InstructionSet>;
    }
  >;
  tournament_ended: EngineEvent<
    'tournament_ended',
    {
      players: Record<InstructionSet['id'], InstructionSet>;
      outcome: TournamentOutcome;
      duration: number;
    }
  >;
  matchups: EngineEvent<
    'matchups',
    {
      matchups: Game[];
      preTournamentFitnessScores: TournamentOutcome;
    }
  >;
  started_game: EngineEvent<
    'started_game',
    {
      id: Game['id'];
      white: {
        id: InstructionSet['id'];
        initialFitnessScore: number;
      };
      black: {
        id: InstructionSet['id'];
        initialFitnessScore: number;
      };
    }
  >;
  game_ended: EngineEvent<
    'game_ended',
    {
      id: Game['id'];
      fen: string;
      pgn: ReturnType<Chess['pgn']>;
      winner: InstructionSet['id'];
      loser: InstructionSet['id'];
      winningColor: Color;
      winningInstructions: Instruction[];
      winningFitnessScore: number;
      losingColor: Color;
      losingInstructions: Instruction[];
      losingFitnessScore: number;
      duration: number;
    }
  >;
  turn_started: EngineEvent<
    'turn_started',
    {
      turnId: string;
      player: InstructionSet['id'];
      color: Color;
      gameId: Game['id'];
      fen: string;
    }
  >;
  turn_ended: EngineEvent<
    'turn_ended',
    {
      turnId: string;
      playerId: InstructionSet['id'];
      fen: string;
      updatedFitnessScore: number;
      duration: number;
    }
  >;
  instruction_match: EngineEvent<
    'instruction_match',
    {
      gameId: Game['id'];
      instruction: Instruction;
      fen: string;
      turnId: string;
    }
  >;
  generated_instruction: EngineEvent<
    'generated_instruction',
    {
      instruction: Instruction;
      playerId: InstructionSet['id'];
      turnId: string;
    }
  >;
  move: EngineEvent<
    'move',
    {
      move: Move;
      playerId: InstructionSet['id'];
      turnId: string;
      instructionId: Instruction['id'];
    }
  >;
  update_fitness_score: EngineEvent<
    'update_fitness_score',
    {
      playerId: InstructionSet['id'];
      turnId: string;
      updatedFitnessScore: number;
      reason:
        | 'turn'
        | 'captured'
        | 'promoted'
        | 'fifty_move_rule'
        | 'forced_draw'
        | 'checked'
        | 'checkmated';
    }
  >;
  spawned: EngineEvent<
    'spawned',
    {
      instructionSet: InstructionSet;
      parents?: [InstructionSet['id'], InstructionSet['id']];
    }
  >;
};

const MAX_SEGMENTS_PER_PATTERN = 12;

export const DEFAULT_TOURNAMENT_SIZE = 16;

const MUTATION_RATE = 0.075;

const columnsToNumericIndexes: Record<Column, number> = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
  f: 6,
  g: 7,
  h: 8,
};

const numericIndexesToColumns: Record<number, Column> = {
  1: 'a',
  2: 'b',
  3: 'c',
  4: 'd',
  5: 'e',
  6: 'f',
  7: 'g',
  8: 'h',
};

const fitnessScores = {
  tournamentMultiplier: 0.5,
  turn: 1,
  captured: 2,
  checked: 3,
  promoted: 3,
  forcedDraw: 5,
  fiftyMoveRule: -50,
  checkmated: 250,
};

// prettier-ignore
export const allPossibleSquares: Square[] = [
  'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8',
  'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8',
  'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8',
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8',
  'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8',
  'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8',
];

export class System {
  private board: Chess;
  private eventEmitter: EventEmitter;

  private players: Record<InstructionSet['id'], InstructionSet> = {};

  constructor(args?: {
    players?: Record<InstructionSet['id'], InstructionSet>;
  }) {
    this.board = new Chess();
    this.eventEmitter = new EventEmitter();
    this.players = args?.players || {};
  }

  subscribe<K extends keyof EngineEvents, E extends EngineEvents[K]>(
    event: K,
    callback: (event: E) => void,
  ) {
    this.eventEmitter.on(event, callback);

    return () => {
      this.eventEmitter.off(event, callback);
    };
  }

  firehose(callback: (event: EngineEvents[keyof EngineEvents]) => void) {
    const events: (keyof EngineEvents)[] = [
      'tournament_started',
      'tournament_ended',
      'matchups',
      'started_game',
      'game_ended',
      'turn_started',
      'turn_ended',
      'instruction_match',
      'generated_instruction',
      'move',
      'update_fitness_score',
    ];

    for (const event of events) {
      this.eventEmitter.on(event, callback);
    }

    return () => {
      for (const event of events) {
        this.eventEmitter.off(event, callback);
      }
    };
  }

  private emit<
    EventName extends keyof EngineEvents,
    EventPayload extends EngineEvents[EventName]['payload'],
  >(eventName: EventName, payload: EventPayload) {
    this.eventEmitter.emit(eventName, { type: eventName, payload });
  }

  getPlayers() {
    return Object.assign({}, this.players);
  }

  getFen() {
    return this.board.fen();
  }

  getAvailablePatternSquareStates(square: Square): PatternSquareState[] {
    const states: PatternSquareState[] = [];

    const squareData = this.board.get(square);

    if (squareData) {
      states.push(`${squareData.color}${squareData.type}`);

      if (squareData.color === this.board.turn()) {
        states.push('f');
      } else {
        states.push('c');
      }
    } else {
      states.push('e');
    }

    return states;
  }

  generateRandomPatternSegment(
    instructionMove: Move,
    square: Square,
  ): PatternSegment {
    let patternLocation: PatternLocation = `!${square}`;

    if (EngineUtils.flipCoin()) {
      const relativeLocations: RelativePatternLocation[] = [];

      const targetMove = EngineUtils.flipCoin() ? 'from' : 'to';
      const targetSquare = instructionMove[targetMove];

      const targetColumnIndex =
        columnsToNumericIndexes[targetSquare[0] as Column];
      const targetRowIndex = parseInt(targetSquare[1]);

      for (let rowIndex = 1; rowIndex <= 8; rowIndex++) {
        for (let columnIndex = 1; columnIndex <= 8; columnIndex++) {
          const rowDifference = rowIndex - targetRowIndex;
          const columnDifference = columnIndex - targetColumnIndex;

          if (rowDifference === 0 && columnDifference === 0) continue;

          const rowOperation = rowDifference > 0 ? '+' : '-';
          const columnOperation = columnDifference > 0 ? '+' : '-';

          const rowRangedOperation: RelativePatternRangedOperation = `${rowOperation}${`${Math.abs(rowDifference)}` as RelativePatternRange}`;
          const columnRangedOperation: RelativePatternRangedOperation = `${columnOperation}${`${Math.abs(columnDifference)}` as RelativePatternRange}`;

          relativeLocations.push(
            `%${targetMove === 'from' ? 'f' : 't'}${columnRangedOperation}${rowRangedOperation}`,
          );
        }
      }

      patternLocation = EngineUtils.pickRandomArrayElement(relativeLocations);
    }

    const possibleStates = EngineUtils.pickRandomArrayElement(
      this.getAvailablePatternSquareStates(square),
    );

    return `${patternLocation}=${possibleStates}`;
  }

  generateRandomPattern(move: Move): PatternSegment[] {
    const fromSquare = this.board.get(move.from);
    const fromPatternSegment: PatternSegment = `!${move.from}=${fromSquare.color}${fromSquare.type}`;
    const toPatternSegment: PatternSegment = `!${move.to}=${EngineUtils.pickRandomArrayElement(this.getAvailablePatternSquareStates(move.to))}`;

    const pattern: PatternSegment[] = [fromPatternSegment, toPatternSegment];

    const totalToGenerate = EngineUtils.getRandomInt(
      0,
      MAX_SEGMENTS_PER_PATTERN - pattern.length,
    );

    for (let i = 0; i < totalToGenerate; i++) {
      const square = EngineUtils.pickRandomArrayElement(allPossibleSquares);

      pattern.push(this.generateRandomPatternSegment(move, square));
    }

    return pattern;
  }

  generateRandomInstruction(): Instruction {
    const moves = this.board.moves({ verbose: true });
    const move = EngineUtils.pickRandomArrayElement(moves);

    const instruction: Instruction = {
      id: uuid(),
      pattern: this.generateRandomPattern(move),
      move: {
        from: move.from,
        to: move.to,
        promotion: move.promotion,
      },
      rank: 0,
    };

    return instruction;
  }

  generateRandomInstructionSet(): InstructionSet {
    const instructionSet = {
      id: uuid(),
      instructions: [],
      generation: 0,
    };

    return instructionSet;
  }

  convertPatternToSquare(
    patternSegment: PatternSegment,
    instruction: Instruction,
  ): Square {
    if (patternSegment.startsWith('!')) {
      return `${patternSegment[1]}${patternSegment[2]}` as Square;
    }

    const startingSquare =
      patternSegment[1] === 'f' ? instruction.move.from : instruction.move.to;
    const startingColumnIndex =
      columnsToNumericIndexes[startingSquare[0] as Column];
    const startingRowIndex = parseInt(startingSquare[1]);

    const columnDirection = patternSegment[2] === '+' ? 1 : -1;
    const columnIncrement = parseInt(patternSegment[3]) * columnDirection;

    const rowDirection = patternSegment[4] === '+' ? 1 : -1;
    const rowIncrement = parseInt(patternSegment[5]) * rowDirection;

    const columnIndex = startingColumnIndex + columnIncrement;

    const column = numericIndexesToColumns[columnIndex];
    const row = `${startingRowIndex + rowIncrement}` as Row;

    return `${column}${row}`;
  }

  extractPatternSegmentData(
    patternSegment: PatternSegment,
    instruction: Instruction,
  ) {
    const [l, patternState] = patternSegment.split('=');
    const square = this.convertPatternToSquare(patternSegment, instruction);
    const squareData = this.board.get(square);

    if (!squareData) {
      return {
        color: 'e',
        piece: 'e',
      };
    }

    const [color, piece] = patternState.split('');
    return {
      color,
      piece,
    };
  }

  checkInstruction(instruction: Instruction) {
    const { move, pattern } = instruction;
    const availableMoves = this.board.moves({ verbose: true });

    if (!move) {
      console.log(instruction);
    }

    const matchingAvailableMove = availableMoves.find(
      (availableMove) =>
        availableMove.from === move.from && availableMove.to === move.to,
    );

    if (
      !matchingAvailableMove ||
      (move.promotion && move.promotion !== matchingAvailableMove.promotion)
    ) {
      return false;
    }

    for (const patternSegment of pattern) {
      const [_l, patternState] = patternSegment.split('=');
      const square = this.convertPatternToSquare(patternSegment, instruction);
      const squareData = this.board.get(square);

      if (patternState === 'e' && !squareData) {
        return false;
      }

      if (patternState !== 'e' && !squareData) {
        return false;
      }

      if (patternState === 'f' && this.board.turn() !== squareData.color) {
        return false;
      }

      if (patternState === 'c' && this.board.turn() === squareData.color) {
        return false;
      }

      const [color, piece] = patternState.split('');
      if (squareData.color !== color || squareData.type !== piece) {
        return false;
      }
    }

    return true;
  }

  setupTournament(tournamentSize: number = DEFAULT_TOURNAMENT_SIZE) {
    if (tournamentSize < 2 || tournamentSize % 2 !== 0) {
      throw new Error('Invalid number of players');
    }

    for (let i = 0; i < tournamentSize; i++) {
      if (Object.keys(this.players).length < tournamentSize) {
        const instructionSet = this.generateRandomInstructionSet();
        this.emit('spawned', { instructionSet });
        this.players[instructionSet.id] = instructionSet;
      }
    }
  }

  private async playTournamentRoundWith(
    playerIds: InstructionSet['id'][],
    priorTournamentOutcome?: TournamentOutcome,
    tournamentRound: number = 1,
  ): Promise<TournamentOutcome> {
    if (playerIds.length < 2 || playerIds.length % 2 !== 0) {
      throw new Error('Invalid number of players');
    }

    const players = playerIds.map((playerId) => this.players[playerId]);
    if (players.length !== playerIds.length) {
      throw new Error('Invalid player id');
    }

    const tournamentOutcome: TournamentOutcome = { ...priorTournamentOutcome };
    for (const player of players) {
      if (!tournamentOutcome[player.id]) {
        tournamentOutcome[player.id] = 0;
      }

      tournamentOutcome[player.id] += Math.ceil(
        tournamentRound * fitnessScores.tournamentMultiplier,
      );
    }

    const games: Game[] = [];
    const winners: InstructionSet['id'][] = [];

    const playersSortedByFitness = players.sort(
      (a, b) => (tournamentOutcome[b.id] || 0) - (tournamentOutcome[a.id] || 0),
    );

    while (playersSortedByFitness.length > 0) {
      const player1 = playersSortedByFitness.shift();
      const player2 = playersSortedByFitness.pop();

      if (player1 && player2) {
        games.push({
          id: uuid(),
          players: EngineUtils.shuffleArray([player1.id, player2.id]) as [
            string,
            string,
          ],
        });
      }
    }

    this.emit('matchups', {
      matchups: games,
      preTournamentFitnessScores: tournamentOutcome,
    });

    for (const game of games) {
      const [white, black] = game.players;
      const whitePlayer = this.players[white];
      const blackPlayer = this.players[black];

      const usedInstructions: Record<InstructionSet['id'], number[]> = {
        [white]: [],
        [black]: [],
      };

      this.board.reset();
      this.emit('started_game', {
        id: game.id,
        white: { id: white, initialFitnessScore: tournamentOutcome[white] },
        black: { id: black, initialFitnessScore: tournamentOutcome[black] },
      });

      const startedGameAt = Date.now();
      let forceGameEnd = false;

      while (!this.board.isGameOver() && !forceGameEnd) {
        // allow event loop to process other stuff
        await new Promise((resolve) => setTimeout(resolve, 0));

        const turnId = uuid();
        const startedTurnAt = Date.now();

        const player = this.board.turn() === 'w' ? whitePlayer : blackPlayer;
        let instruction: Instruction | null = null;

        this.emit('turn_started', {
          turnId,
          player: player.id,
          color: this.board.turn() as Color,
          gameId: game.id,
          fen: this.board.fen(),
        });

        for (let i = 0; i < player.instructions.length; i++) {
          const possibleInstruction = player.instructions[i];

          if (this.checkInstruction(possibleInstruction)) {
            this.emit('instruction_match', {
              gameId: game.id,
              instruction: possibleInstruction,
              fen: this.board.fen(),
              turnId,
            });

            instruction = possibleInstruction;
            usedInstructions[player.id].push(i);
            break;
          }
        }

        if (!instruction) {
          instruction = this.generateRandomInstruction();
          this.players[player.id].instructions.push(instruction);
          usedInstructions[player.id].push(player.instructions.length - 1);

          this.emit('generated_instruction', {
            instruction,
            playerId: player.id,
            turnId,
          });
        }

        this.board.history().length > 100
          ? (tournamentOutcome[player.id] -= fitnessScores.turn)
          : (tournamentOutcome[player.id] += fitnessScores.turn);

        this.emit('update_fitness_score', {
          playerId: player.id,
          turnId,
          updatedFitnessScore: tournamentOutcome[player.id],
          reason: 'turn',
        });

        this.board.move(instruction.move);

        this.emit('move', {
          move: instruction.move,
          playerId: player.id,
          turnId,
          instructionId: instruction.id,
        });

        if (ChessHelpers.checkCapture(this.board, instruction.move.to)) {
          tournamentOutcome[player.id] += fitnessScores.captured;

          this.emit('update_fitness_score', {
            playerId: player.id,
            turnId,
            updatedFitnessScore: tournamentOutcome[player.id],
            reason: 'captured',
          });
        }

        if (instruction.move.promotion) {
          tournamentOutcome[player.id] += fitnessScores.promoted;

          this.emit('update_fitness_score', {
            playerId: player.id,
            turnId,
            updatedFitnessScore: tournamentOutcome[player.id],
            reason: 'promoted',
          });
        }

        if (ChessHelpers.isFiftyMoveRule(this.board)) {
          tournamentOutcome[player.id] += fitnessScores.fiftyMoveRule;
          forceGameEnd = true;

          this.emit('update_fitness_score', {
            playerId: player.id,
            turnId,
            updatedFitnessScore: tournamentOutcome[player.id],
            reason: 'fifty_move_rule',
          });
        }

        if (ChessHelpers.isDraw(this.board)) {
          tournamentOutcome[player.id] += fitnessScores.forcedDraw;

          this.emit('update_fitness_score', {
            playerId: player.id,
            turnId,
            updatedFitnessScore: tournamentOutcome[player.id],
            reason: 'forced_draw',
          });
        }

        if (this.board.inCheck()) {
          tournamentOutcome[player.id] += fitnessScores.checked;

          this.emit('update_fitness_score', {
            playerId: player.id,
            turnId,
            updatedFitnessScore: tournamentOutcome[player.id],
            reason: 'checked',
          });
        }

        if (this.board.isCheckmate()) {
          tournamentOutcome[player.id] += fitnessScores.checkmated;

          this.emit('update_fitness_score', {
            playerId: player.id,
            turnId,
            updatedFitnessScore: tournamentOutcome[player.id],
            reason: 'checkmated',
          });
        }

        this.emit('turn_ended', {
          turnId,
          playerId: player.id,
          fen: this.board.fen(),
          updatedFitnessScore: tournamentOutcome[player.id],
          duration: Date.now() - startedTurnAt,
        });
      }

      const duration = Date.now() - startedGameAt;
      const winningInstructions: Instruction[] = [];
      const losingInstructions: Instruction[] = [];

      const [winnerId, loserId] =
        tournamentOutcome[white] > tournamentOutcome[black]
          ? [white, black]
          : [black, white];

      for (const index of usedInstructions[winnerId]) {
        this.players[winnerId].instructions[index].rank++;
        winningInstructions.push(this.players[winnerId].instructions[index]);
      }

      for (const index of usedInstructions[loserId]) {
        this.players[loserId].instructions[index].rank--;
        losingInstructions.push(this.players[loserId].instructions[index]);
      }

      this.players[winnerId].instructions.sort((a, b) => b.rank - a.rank);
      this.players[loserId].instructions.sort((a, b) => b.rank - a.rank);
      winners.push(winnerId);

      this.emit('game_ended', {
        id: game.id,
        fen: this.board.fen(),
        pgn: this.board.pgn(),
        winner: winnerId,
        loser: loserId,
        duration,
        winningColor: winnerId === white ? 'w' : 'b',
        winningInstructions,
        winningFitnessScore: tournamentOutcome[winnerId],
        losingColor: loserId === white ? 'w' : 'b',
        losingInstructions,
        losingFitnessScore: tournamentOutcome[loserId],
      });
    }

    if (winners.length > 1) {
      return this.playTournamentRoundWith(
        winners,
        tournamentOutcome,
        tournamentRound + 1,
      );
    }

    return tournamentOutcome;
  }

  async startTournament(): Promise<TournamentOutcome> {
    if (
      Object.keys(this.players).length < 2 ||
      Object.keys(this.players).length % 2 !== 0
    ) {
      throw new Error('Invalid number of players');
    }

    this.emit('tournament_started', {
      tournamentSize: Object.keys(this.players).length,
      players: this.getPlayers(),
    });

    const startedAt = Date.now();
    const tournamentOutcome = await this.playTournamentRoundWith(
      Object.keys(this.players),
    );

    this.emit('tournament_ended', {
      players: this.getPlayers(),
      outcome: tournamentOutcome,
      duration: Date.now() - startedAt,
    });

    return tournamentOutcome;
  }

  evolvePlayers(tournamentOutcome: TournamentOutcome) {
    const playerFitnessScores = Object.keys(tournamentOutcome).sort(
      (a, b) => tournamentOutcome[b] - tournamentOutcome[a],
    );

    const topPlayerIds = playerFitnessScores.slice(0, 2);
    const topPlayers = topPlayerIds.map((id) =>
      Object.assign({}, this.players[id]),
    );

    topPlayers[0].instructions.sort((a, b) => b.rank - a.rank);
    topPlayers[1].instructions.sort((a, b) => b.rank - a.rank);

    const children: InstructionSet[] = [topPlayers[0], topPlayers[1]];

    const targetInstructionListLength = Math.floor(
      ((topPlayers[0].instructions.length + topPlayers[1].instructions.length) /
        2) *
        0.85,
    );

    const offspringToGenerate = Object.keys(this.players).length - 2;

    for (let i = 0; i < offspringToGenerate; i++) {
      const child: InstructionSet = {
        id: uuid(),
        instructions: [],
        generation: topPlayers[0].generation + 1,
        parents: [topPlayerIds[0], topPlayerIds[1]],
      };

      for (let j = 0; j < targetInstructionListLength; j++) {
        const parent = EngineUtils.flipCoin() ? topPlayers[0] : topPlayers[1];

        const copyIndex = Math.floor(
          EngineUtils.randomBoxMuller(0, parent.instructions.length - 1, 3),
        );

        const newInstruction = Object.assign(
          {},
          parent.instructions[copyIndex],
        );

        if (Math.random() < MUTATION_RATE) {
          const adjustment = EngineUtils.getRandomInt(1, 3);
          newInstruction.rank += EngineUtils.flipCoin()
            ? adjustment
            : -adjustment;
        }

        child.instructions.push(newInstruction);
      }

      child.instructions.sort((a, b) => b.rank - a.rank);
      children.push(child);

      this.emit('spawned', {
        instructionSet: child,
        parents: [topPlayers[0].id, topPlayers[1].id],
      });
    }

    this.players = children.reduce<typeof this.players>((acc, player) => {
      acc[player.id] = player;
      return acc;
    }, {});
  }

  migration(newPlayers: InstructionSet[]) {
    for (let i = 0; i < newPlayers.length; i++) {
      const replaceIndex = Object.keys(this.players).length - 1 - i;
      if (replaceIndex < 0) {
        throw new Error('Invalid number of players in migration');
      }

      this.players[replaceIndex] = newPlayers[i];
    }
  }
}
