import { Chess } from 'chess.js';
import { expect, test, describe } from 'vitest';
import * as Engine from './index';
import * as EngineConstants from './constants';
import * as EngineUtils from './utils';

function testManyTimes(
	callback: (done: () => void) => void,
	times: number = 100,
	onComplete?: () => void,
) {
	for (let i = 0; i < times; i++) {
		const done = () => {
			i = times;
		};
		callback(done);
	}

	if (onComplete) onComplete();
}

describe('generating tokens', () => {
	test('generate random token that has no parent', () => {
		testManyTimes(() => {
			const token = Engine.generateRandomToken(null);
			expect(EngineUtils.isFunctionId(token.id)).toBe(true);
		});
	});

	test('generate random token that has no sub functions', () => {
		testManyTimes(() => {
			const token = Engine.generateRandomToken('add', 3);
			expect(EngineUtils.isFunctionId(token.id)).toBe(false);
		});
	});

	test('generate random token that has sub functions', () => {
		let passed = false;
		testManyTimes(
			(done) => {
				const token = Engine.generateRandomToken('add', 1);
				if (EngineUtils.isFunctionId(token.id)) {
					passed = true;
					done();
				}
			},
			100,
			() => expect(passed).toBe(true),
		);
	});

	test('generate random token that is a variable', () => {
		let passed = false;
		testManyTimes(
			(done) => {
				const token = Engine.generateRandomToken('add', 1);
				if (EngineUtils.isVariableId(token.id)) {
					passed = true;
					done();
				}
			},
			100,
			() => expect(passed).toBe(true),
		);
	});
});

describe('traversing the algorithm tokens', () => {
	test('confirm token count', () => {
		testManyTimes(() => {
			const algorithm = Engine.initializeNewAlgorithm();
			algorithm.rootToken = {
				id: 'add',
				args: [
					{ id: 'custom_1' },
					{
						id: 'sub',
						args: [{ id: 'custom_2' }, { id: 'adjacent_friendly_bishops' }],
					},
				],
			};

			let walkTokenCount = 0;
			Engine.walkAlgorithmTokens(algorithm, () => walkTokenCount++);

			expect(walkTokenCount).toBe(5);
		});
	});

	test('setting new root value', () => {
		const algorithm = Engine.initializeNewAlgorithm();
		Engine.walkAlgorithmTokens(algorithm, (p, t, done) => {
			done({ id: 'adjacent_empty_squares' });
		});

		expect(JSON.stringify(algorithm.rootToken)).toEqual(
			JSON.stringify({ id: 'adjacent_empty_squares' }),
		);
	});

	test('setting new child value', () => {
		const algorithm = Engine.initializeNewAlgorithm();
		Engine.walkAlgorithmTokens(algorithm, (p, t, done) => {
			if (!!p) done({ id: 'adjacent_empty_squares' });
		});

		expect(JSON.stringify(algorithm.rootToken)).toContain(
			JSON.stringify({ id: 'adjacent_empty_squares' }),
		);

		expect(JSON.stringify(algorithm.rootToken)).not.toEqual(
			JSON.stringify({ id: 'adjacent_empty_squares' }),
		);
	});
});

describe('mutating algorithms', () => {
	test('confirm successful mutation', () => {
		testManyTimes(() => {
			const original = Engine.initializeNewAlgorithm();
			const originalCopy = JSON.stringify(original);

			const mutated = Engine.mutateAlgorithm(original);

			// Confirm 'mutateAlgorithm' has no side effects
			expect(JSON.stringify(original)).toEqual(originalCopy);

			expect(JSON.stringify(original.rootToken)).not.toEqual(
				JSON.stringify(mutated.algorithm.rootToken),
			);
			expect(JSON.stringify(original.memory)).not.toEqual(
				JSON.stringify(mutated.algorithm.memory),
			);

			const lastMutation = [...mutated.tokenMutations].pop();
			expect(JSON.stringify(mutated.algorithm.rootToken)).to.contain(
				JSON.stringify(lastMutation),
			);
		}, 5000); // need to run this enough times to catech edge cases with randomness
	});
});

describe('evolving an algorithm', () => {
	test('creates 9 offspring', () => {
		testManyTimes(() => {
			const init = Engine.initializeNewAlgorithm();
			const initStringified = JSON.stringify(init);

			const offspring = Engine.evolveAlgorithm(init, 9);

			expect(offspring.length).toBe(10);
			expect(initStringified).toEqual(JSON.stringify(offspring[0].algorithm));

			const testSet = offspring.map((m) => JSON.stringify(m.algorithm));
			expect(testSet.length).toBe(10);
		});
	});

	test('clears the dynamic memory', () => {
		const init = Engine.initializeNewAlgorithm();
		init.memory[EngineConstants.STATIC_MEMORY_SIZE + 1].value = 1;

		const offspring = Engine.evolveAlgorithm(init, 9);
		offspring.forEach((m) =>
			expect(
				m.algorithm.memory[EngineConstants.STATIC_MEMORY_SIZE + 1].value,
			).toBe(0),
		);
	});
});

describe('populating variables', () => {
	test('should populate memory variables', () => {
		const board = new Chess();
		const algorithm = Engine.initializeNewAlgorithm();
		algorithm.memory[0].value = 1;

		expect(
			Engine.populateVariable('custom_0', algorithm, board, 'a1', 'w').value,
		).toEqual(1);
	});

	test('should populate is_king', () => {
		const board = new Chess();
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('is_king', algorithm, board, 'e2', 'w').value,
		).toEqual(0);
		expect(
			Engine.populateVariable('is_king', algorithm, board, 'e1', 'w').value,
		).toEqual(1);
	});

	test('should populate is_empty', () => {
		const board = new Chess();
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('is_empty', algorithm, board, 'e1', 'w').value,
		).toEqual(0);
		expect(
			Engine.populateVariable('is_empty', algorithm, board, 'e5', 'w').value,
		).toEqual(1);
	});

	test('should populate is_self', () => {
		const board = new Chess();
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('is_self', algorithm, board, 'e1', 'w').value,
		).toEqual(1);
		expect(
			Engine.populateVariable('is_self', algorithm, board, 'e1', 'b').value,
		).toEqual(0);
	});

	test('should populate is_opponent', () => {
		const board = new Chess();
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('is_opponent', algorithm, board, 'e1', 'w').value,
		).toEqual(0);
		expect(
			Engine.populateVariable('is_opponent', algorithm, board, 'e1', 'b').value,
		).toEqual(1);
	});

	test('should populate captured_piece', () => {
		const board = new Chess(
			'rnb1k1nr/pppp1ppp/3bp3/4N2q/3PP3/2P5/PP2QPPP/RNB1KB1R b KQkq - 4 6',
		);
		board.move({ from: 'h5', to: 'e2' });
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('captured_piece', algorithm, board, 'e2', 'b')
				.value,
		).toEqual(1);
		expect(
			Engine.populateVariable('captured_piece', algorithm, board, 'e1', 'b')
				.value,
		).toEqual(0);
	});

	test('should populate captured_queen', () => {
		const board = new Chess(
			'rnb1k1nr/pppp1ppp/3bp3/4N2q/3PP3/2P5/PP2QPPP/RNB1KB1R b KQkq - 4 6',
		);
		board.move({ from: 'h5', to: 'e2' });
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('captured_queen', algorithm, board, 'e2', 'b')
				.value,
		).toEqual(1);
		expect(
			Engine.populateVariable('captured_queen', algorithm, board, 'e1', 'b')
				.value,
		).toEqual(0);
	});

	test('should populate lost_queen', () => {
		const board = new Chess(
			'rnb1k1nr/pppp1ppp/3bp3/4N2q/3PP3/2P5/PP2QPPP/RNB1KB1R b KQkq - 4 6',
		);
		board.move({ from: 'h5', to: 'e2' });
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('lost_queen', algorithm, board, 'e2', 'w').value,
		).toEqual(1);
		expect(
			Engine.populateVariable('lost_queen', algorithm, board, 'e1', 'w').value,
		).toEqual(0);
	});

	test('should populate is_in_check', () => {
		const board = new Chess(
			'rnb1k1nr/pppp1ppp/4p3/8/1b1PP2q/8/PPP1QPPP/RNB1KBNR w KQkq - 3 4',
		);
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('is_in_check', algorithm, board, 'e1', 'w').value,
		).toEqual(1);
		expect(
			Engine.populateVariable('is_in_check', algorithm, board, 'e2', 'w').value,
		).toEqual(0);
		expect(
			Engine.populateVariable('is_in_check', algorithm, board, 'd1', 'w').value,
		).toEqual(0);
	});

	test('should populate is_in_checkmate', () => {
		const board = new Chess(
			'rnbq1rk1/2ppnpQp/1p6/p2P4/2P1p3/5N2/PB2PPPP/RN2KB1R b KQ - 0 9',
		);
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('is_in_checkmate', algorithm, board, 'g8', 'b').value,
		).toEqual(1);
		expect(
			Engine.populateVariable('is_in_checkmate', algorithm, board, 'e1', 'w').value,
		).toEqual(0);
	});

	test('should populate possible_moves', () => {
		const board = new Chess();
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable('possible_moves', algorithm, board, 'e2', 'w').value,
		).toEqual(2);
	});

	test('should populate friendly_knight_can_move_here', () => {
		const board = new Chess();
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable(
				'friendly_knight_can_move_here',
				algorithm,
				board,
				'f3',
				'w',
			).value,
		).toEqual(1);
		expect(
			Engine.populateVariable(
				'friendly_knight_can_move_here',
				algorithm,
				board,
				'f6',
				'b',
			).value,
		).toEqual(0);
	});

	test('should populate opponent_knight_can_move_here', () => {
		const board = new Chess();
		const algorithm = Engine.initializeNewAlgorithm();

		expect(
			Engine.populateVariable(
				'opponent_knight_can_move_here',
				algorithm,
				board,
				'f3',
				'w',
			).value,
		).toEqual(0);
		expect(
			Engine.populateVariable(
				'opponent_knight_can_move_here',
				algorithm,
				board,
				'f6',
				'b',
			).value,
		).toEqual(0);
	});
});

// evaluateAlgorithm tests
//  - hand craft an algorithm that leads to quick checkmate, confirm fitness applied correctly
//  - timeout works

// create seperate functions/tests for deriving the variables, picking the move, awarding fitness points
