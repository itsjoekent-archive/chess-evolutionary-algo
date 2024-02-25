import { Chess } from 'chess.js';
import { expect, expectTypeOf, test, describe, vi } from 'vitest';
import * as Engine from './index';
import type { EngineEvents } from './index';

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
    const system = new Engine.System();
    const board = new Chess();

    const instruction = system.generateRandomInstruction();

    expect(instruction).toBeDefined();

    expect(instruction.pattern[0]).toContain(instruction.move.from);
    expect(instruction.pattern[1]).toContain(instruction.move.to);

    expect(() => board.move(instruction.move)).not.toThrow();
  });

  test('should always be less than 12 conditionals', () => {
    testManyTimes(() => {
      const instruction = new Engine.System().generateRandomInstruction();
      expect(instruction.pattern.length).toBeLessThanOrEqual(12);
      expect(instruction.pattern.length).toBeGreaterThanOrEqual(2);
      expect(instruction.pattern.join(' ')).not.toContain('undefined');
    });
  });
});

describe('tournament', () => {
  test('should set up a tournament', async () => {
    const system = new Engine.System();
    const listener = vi.fn();

    system.subscribe('spawned', (event) => {
      expectTypeOf(event).toEqualTypeOf<EngineEvents['spawned']>;
    });

    system.subscribe('spawned', listener);

    system.setupTournament(12);
    expect(Object.keys(system.getPlayers())).toHaveLength(12);

    expect(listener).toHaveBeenCalledTimes(12);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.anything() }),
    );
  });
});
