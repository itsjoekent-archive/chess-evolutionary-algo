import { Chess } from 'chess.js';
import { expect, test, describe } from 'vitest';
import * as Engine from './index';

function testManyTimes(
	callback: (done: () => void) => void,
	params?: {
		times?: number;
		onComplete?: () => void;
	},
) {
	const times = params?.times || 100;
	for (let i = 0; i < times; i++) {
		const done = () => {
			i = times;
		};
		callback(done);
	}

	if (params?.onComplete) params?.onComplete();
}

describe('generation', () => {
	test('generate random instruction', () => {
		const board = new Chess();
		const instruction = new Engine.System().generateRandomInstruction();
		expect(instruction).toBeDefined();

		expect(instruction.pattern[0]).toContain('!');
		expect(instruction.pattern[1]).toContain('!');

		expect(() => board.move(instruction.move)).not.toThrow();
	});

	test('should always be less than 32 bits', () => {
		testManyTimes(() => {
			const instruction = new Engine.System().generateRandomInstruction();
			expect(instruction.pattern.length).toBeLessThanOrEqual(32);
			expect(instruction.pattern.length).toBeGreaterThanOrEqual(2);
			expect(instruction.pattern.join(' ')).not.toContain('undefined');
		});
	});

	test('should generate a relative from token', () => {
		let passed = false;
		testManyTimes(
			(done) => {
				const instruction = new Engine.System().generateRandomInstruction();

				if (instruction.pattern.join(' ').includes('%f')) {
					passed = true;
					done();
				}
			},
			{
				onComplete: () => expect(passed).toBe(true),
			},
		);
	});

	test('should generate a relative to token', () => {
		let passed = false;
		testManyTimes(
			(done) => {
				const instruction = new Engine.System().generateRandomInstruction();

				if (instruction.pattern.join(' ').includes('%t')) {
					passed = true;
					done();
				}
			},
			{
				onComplete: () => expect(passed).toBe(true),
			},
		);
	});

	test('should generate valid relative tokens', () => {
		testManyTimes(() => {
      const system = new Engine.System();
			const instruction = system.generateRandomInstruction();

			instruction.pattern.forEach((segment) => {
				if (segment.startsWith('%')) {
					expect(segment).toMatch(/%[ft][+-]\d+[+-]\d+/);
					expect(Engine.allPossibleSquares).toContain(
						system.convertPatternToSquare(segment, instruction),
					);
				}
			});
		});
	});
});

describe('pattern conversion', () => {
  test('absolute patterns', () => {
    const system = new Engine.System();
    const instruction = system.generateRandomInstruction();
    expect(
			system.convertPatternToSquare(instruction.pattern[0], instruction),
		).toBe(instruction.move.from);
  });

  test('relative patterns', () => {
    const system = new Engine.System();
		const instruction = system.generateRandomInstruction();
    instruction.move.from = 'a1';
    instruction.move.to = 'h8';

    expect(system.convertPatternToSquare('%f+1+1=e', instruction)).toBe('b2');
    expect(system.convertPatternToSquare('%t-6-6=e', instruction)).toBe('b2');
  });
});
