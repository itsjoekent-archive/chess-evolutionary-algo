import { Chess } from 'chess.js';
import EventEmitter from 'eventemitter3';
import { v4 as uuid } from 'uuid';
import * as EngineUtils from './utils';

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
	fitness: number;
};

export type InstructionSet = Instruction[];

const MAX_SEGMENTS_PER_PATTERN = 32;

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

	private players: [InstructionSet, InstructionSet] | null;

	constructor(args?: {
    fen?: string
    players?: [InstructionSet, InstructionSet],
  }) {
		this.board = new Chess(args?.fen);
		this.eventEmitter = new EventEmitter();
    this.players = args?.players || null;
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

			const columnIndex = columnsToNumericIndexes[targetSquare[0] as Column];
			const rowIndex = parseInt(targetSquare[1]);

			for (let row = 1; row <= 8; row++) {
				for (let column = 1; column <= 8; column++) {
					const rowDifference = Math.max(rowIndex - row, 0);
					const columnDifference = Math.max(columnIndex - column, 0);

					if (rowDifference === 0 && columnDifference === 0) continue;

					const rowOperation = row > rowIndex ? '+' : '-';
					const columnOperation = column > columnIndex ? '+' : '-';

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
		const fromPatternSegment: PatternSegment = `!${move.from}=${this.board.get(move.from).color}${this.board.get(move.from).type}`;
		const toPatternSegment: PatternSegment = `!${move.to}=${EngineUtils.pickRandomArrayElement(this.getAvailablePatternSquareStates(move.to))}`;

		const pattern: PatternSegment[] = [fromPatternSegment, toPatternSegment];

		const totalToGenerate = EngineUtils.randomBoxMuller(
			0,
			MAX_SEGMENTS_PER_PATTERN - pattern.length,
			1,
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
			},
			fitness: 0,
		};

		return instruction;
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
}
