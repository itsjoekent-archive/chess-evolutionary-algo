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
			const token = Engine.generateRandomToken(null, 'board');
			expect(EngineUtils.isFunctionId(token.id)).toBe(true);
		});
	});

	test('confirm depth does not go beyond limit', () => {
		testManyTimes(() => {
			const token = Engine.generateRandomToken('add', 'board', 3);
			expect(EngineUtils.isFunctionId(token.id)).toBe(false);
		});
	});

	test('generate random token that has sub functions', () => {
		let passed = false;
		testManyTimes(
			(done) => {
				const token = Engine.generateRandomToken('add', 'board', 1);
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
				const token = Engine.generateRandomToken('add', 'board', 1);
				if (EngineUtils.isVariableId(token.id)) {
					passed = true;
					done();
				}
			},
			100,
			() => expect(passed).toBe(true),
		);
	});

	test('confirm board algorithm does not have movement algorithm tokens', () => {
		testManyTimes(() => {
			const algorithm = Engine.initializeNewAlgorithm('board');
			Engine.walkAlgorithmTokens(algorithm, ({ token }) => expect(token.id).not.toBe('depth'));
		}, 1000);
	});

	test('confirm movement algorithm does not have board algorithm tokens', () => {
		testManyTimes(() => {
			const algorithm = Engine.initializeNewAlgorithm('movement');
			Engine.walkAlgorithmTokens(algorithm, ({ token }) =>
				expect(token.id).not.toBe('pawn_was_captured'),
			);
		}, 1000);
	});
});

describe('traversing the algorithm tokens', () => {
	test('confirm token count', () => {
		testManyTimes(() => {
			const algorithm = Engine.initializeNewAlgorithm('board');
			algorithm.rootToken = {
				id: 'add',
				args: [
					{ id: 'custom_1' },
					{
						id: 'sub',
						args: [{ id: 'custom_2' }, { id: 'is_in_check' }],
					},
				],
			};

			let walkTokenCount = 0;
			Engine.walkAlgorithmTokens(algorithm, () => walkTokenCount++);

			expect(walkTokenCount).toBe(5);
		});
	});

	test('setting new root value', () => {
		const algorithm = Engine.initializeNewAlgorithm('board');
		Engine.walkAlgorithmTokens(algorithm, ({ done }) => {
			done({ id: 'is_draw' });
		});

		expect(JSON.stringify(algorithm.rootToken)).toEqual(
			JSON.stringify({ id: 'is_draw' }),
		);
	});

	test('setting new child value', () => {
		const algorithm = Engine.initializeNewAlgorithm('board');
		Engine.walkAlgorithmTokens(algorithm, ({ parent, done }) => {
			if (!!parent) done({ id: 'castled_king_side' });
		});

		expect(JSON.stringify(algorithm.rootToken)).toContain(
			JSON.stringify({ id: 'castled_king_side' }),
		);

		expect(JSON.stringify(algorithm.rootToken)).not.toEqual(
			JSON.stringify({ id: 'castled_king_side' }),
		);
	});
});

describe('mutating algorithms', () => {
	test('confirm successful mutation', () => {
		testManyTimes(() => {
			const original = Engine.initializeNewAlgorithm('board');
			const originalCopy = JSON.stringify(original);

			const mutated = Engine.mutateAlgorithm(original);

			// Confirm 'mutateAlgorithm' has no side effects
			expect(JSON.stringify(original)).toEqual(originalCopy);

			expect(JSON.stringify(original.rootToken)).not.toEqual(
				JSON.stringify(mutated.algorithm.rootToken),
			);

			const lastMutation = [...mutated.tokenMutations].pop();
			expect(JSON.stringify(mutated.algorithm.rootToken)).to.contain(
				JSON.stringify(lastMutation?.to),
			);
		}, 5000); // need to run this enough times to catech edge cases with randomness
	});
});

describe('evolving an algorithm', () => {
	test('creates 10 offspring', () => {
		testManyTimes(() => {
			const init = Engine.initializeNewInstance();
			const initBoardAlgorithmStringified = JSON.stringify(init.boardAlgorithm);

			const mutation = Engine.evolveInstance(init, 9);

			expect(mutation.children.length).toBe(10);
			expect(initBoardAlgorithmStringified).toEqual(
				JSON.stringify(mutation.children[0].instance.boardAlgorithm),
			);

			const testSet = new Set(
				mutation.children.map((m) => EngineUtils.hashInstance(m.instance)),
			);
			expect(testSet.size).toBe(10);

			const testIdSet = new Set([
				...mutation.children.map((m) => m.instance.id),
				init.id,
			]);
			expect(testIdSet.size).toBe(11);
		});
	});

	test('clears the dynamic memory', () => {
		const init = Engine.initializeNewInstance();
		init.memory[EngineConstants.STATIC_MEMORY_SIZE + 1].value = 1;

		const mutation = Engine.evolveInstance(init, 1);
		expect(
			mutation.children[0].instance.memory[
				EngineConstants.STATIC_MEMORY_SIZE + 1
			].value,
		).toBe(0);
		expect(
			mutation.children[1].instance.memory[
				EngineConstants.STATIC_MEMORY_SIZE + 1
			].value,
		).toBe(0);
	});
});

describe('populating variables', () => {
	test('should populate memory variables', () => {
		const board = new Chess();
		const instance = Engine.initializeNewInstance();
		instance.memory[0].value = 1;

		expect(
			Engine.populateVariable('custom_0', instance, board, 'a1', 'w').value,
		).toEqual(1);
	});

	test('should populate is_king', () => {
		const board = new Chess();
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable('is_king', instance, board, 'e2', 'w').value,
		).toEqual(0);
		expect(
			Engine.populateVariable('is_king', instance, board, 'e1', 'w').value,
		).toEqual(1);
	});

	test('should populate is_empty', () => {
		const board = new Chess();
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable('is_empty', instance, board, 'e1', 'w').value,
		).toEqual(0);
		expect(
			Engine.populateVariable('is_empty', instance, board, 'e5', 'w').value,
		).toEqual(1);
	});

	test('should populate is_self', () => {
		const board = new Chess();
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable('is_self', instance, board, 'e1', 'w').value,
		).toEqual(1);
		expect(
			Engine.populateVariable('is_self', instance, board, 'e1', 'b').value,
		).toEqual(0);
	});

	test('should populate is_opponent', () => {
		const board = new Chess();
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable('is_opponent', instance, board, 'e1', 'w').value,
		).toEqual(0);
		expect(
			Engine.populateVariable('is_opponent', instance, board, 'e1', 'b').value,
		).toEqual(1);
	});

	test('should populate was_captured', () => {
		const board = new Chess(
			'rnb1k1nr/pppp1ppp/3bp3/4N2q/3PP3/2P5/PP2QPPP/RNB1KB1R b KQkq - 4 6',
		);
		board.move({ from: 'h5', to: 'e2' });
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable('was_captured', instance, board, 'e2', 'b').value,
		).toEqual(1);
		expect(
			Engine.populateVariable('was_captured', instance, board, 'e1', 'b').value,
		).toEqual(0);
	});

	test('should populate queen_was_captured', () => {
		const board = new Chess(
			'rnb1k1nr/pppp1ppp/3bp3/4N2q/3PP3/2P5/PP2QPPP/RNB1KB1R b KQkq - 4 6',
		);
		board.move({ from: 'h5', to: 'e2' });
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable('queen_was_captured', instance, board, 'e2', 'b')
				.value,
		).toEqual(1);
		expect(
			Engine.populateVariable('queen_was_captured', instance, board, 'e1', 'b')
				.value,
		).toEqual(0);
	});

	test('should populate is_in_check', () => {
		const board = new Chess(
			'rnb1k1nr/pppp1ppp/4p3/8/1b1PP2q/8/PPP1QPPP/RNB1KBNR w KQkq - 3 4',
		);
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable('is_in_check', instance, board, 'e2', 'w').value,
		).toEqual(1);
	});

	test('should populate is_in_checkmate', () => {
		const board = new Chess(
			'rnbq1rk1/2ppnpQp/1p6/p2P4/2P1p3/5N2/PB2PPPP/RN2KB1R b KQ - 0 9',
		);
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable('is_in_checkmate', instance, board, 'g8', 'b')
				.value,
		).toEqual(1);
	});

	test('should populate possible_moves', () => {
		const board = new Chess();
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable('possible_moves', instance, board, 'e2', 'w')
				.value,
		).toEqual(2);
	});

	test('should populate knight_can_move_here', () => {
		const board = new Chess();
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable(
				'knight_can_move_here',
				instance,
				board,
				'f3',
				'w',
			).value,
		).toEqual(1);
	});

	test('should populate knight_can_move_here', () => {
		const board = new Chess();
		const instance = Engine.initializeNewInstance();

		expect(
			Engine.populateVariable(
				'knight_can_move_here',
				instance,
				board,
				'c3',
				'w',
			).value,
		).toEqual(1);
		expect(
			Engine.populateVariable(
				'knight_can_move_here',
				instance,
				board,
				'f3',
				'w',
			).value,
		).toEqual(1);
	});

	test('should populate castled_king_side', () => {
		const board = new Chess(
			'rnbqkbnr/pp3ppp/2ppp3/8/8/5NP1/PPPPPPBP/RNBQK2R w KQkq - 0 4',
		);
		const instance = Engine.initializeNewInstance();

		board.move({ from: 'e1', to: 'g1' });

		expect(
			Engine.populateVariable('castled_king_side', instance, board, 'g1', 'w')
				.value,
		).toEqual(1);
	});

	test('should draw after 3 fold repetition', () => {
		const board = new Chess();
		const instance = Engine.initializeNewInstance();

		board.move({ from: 'b1', to: 'c3' });
		board.move({ from: 'b8', to: 'c6' });

		board.move({ from: 'c3', to: 'b1' });
		board.move({ from: 'c6', to: 'b8' });

		board.move({ from: 'b1', to: 'c3' });
		board.move({ from: 'b8', to: 'c6' });

		board.move({ from: 'c3', to: 'b1' });
		board.move({ from: 'c6', to: 'b8' });

		expect(
			Engine.populateVariable('is_draw', instance, board, 'g1', 'w').value,
		).toEqual(1);
	});
});

// can_capture_

// evaluateAlgorithm tests
//  - hand craft an algorithm that leads to quick checkmate, confirm fitness applied correctly
//  - timeout works

// create seperate functions/tests for deriving the variables, picking the move, awarding fitness points
