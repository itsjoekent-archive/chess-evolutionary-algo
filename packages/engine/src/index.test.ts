import { expect, test, describe } from 'vitest';
import * as Engine from './index';
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
	test.only('confirm successful mutation', () => {
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
