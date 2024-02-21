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
      Engine.walkAlgorithmTokens(algorithm, ({ token }) =>
        expect(token.id).not.toBe('depth'),
      );
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
  const outputs = {
    firstIterationPreMoveTotal: 0,
    firstIterationPostMoveTotal: 0,
    prevIterationPreMoveTotal: 0,
    prevIterationPostMoveTotal: 0,
    thisIterationPreMoveTotal: 0,
    thisIterationPostMoveTotal: 0,
  };

  test('should populate memory variables', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();
    instance.memory[0].value = 1;

    expect(
      Engine.populateVariable('custom_0', 'a1', {
        instance,
        board,
        color: 'w',
        depth: 0,
        outputs,
      }).value,
    ).toEqual(1);
  });

  test('should populate is_king', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('is_king', 'e2', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(0);
    expect(
      Engine.populateVariable('is_king', 'e1', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
  });

  test('should populate is_empty', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('is_empty', 'e1', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(0);
    expect(
      Engine.populateVariable('is_empty', 'e5', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
  });

  test('should populate is_self', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('is_self', 'e1', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
    expect(
      Engine.populateVariable('is_self', 'e1', {
        instance,
        board,
        color: 'b',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(0);
  });

  test('should populate is_opponent', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('is_opponent', 'e1', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(0);
    expect(
      Engine.populateVariable('is_opponent', 'e1', {
        instance,
        board,
        color: 'b',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
  });

  test('should populate promoted', () => {
    const board = new Chess('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1');
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('promoted', 'b8', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(0);

    board.move({ from: 'b7', to: 'b8', promotion: 'q' });

    expect(
      Engine.populateVariable('promoted', 'b8', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
  });

  test('should populate was_captured', () => {
    const board = new Chess(
      'rnb1k1nr/pppp1ppp/3bp3/4N2q/3PP3/2P5/PP2QPPP/RNB1KB1R b KQkq - 4 6',
    );
    board.move({ from: 'h5', to: 'e2' });
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('was_captured', 'e2', {
        instance,
        board,
        color: 'b',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
    expect(
      Engine.populateVariable('was_captured', 'e1', {
        instance,
        board,
        color: 'b',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(0);
  });

  test('should populate queen_was_captured', () => {
    const board = new Chess(
      'rnb1k1nr/pppp1ppp/3bp3/4N2q/3PP3/2P5/PP2QPPP/RNB1KB1R b KQkq - 4 6',
    );
    board.move({ from: 'h5', to: 'e2' });
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('queen_was_captured', 'e2', {
        instance,
        board,
        color: 'b',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
    expect(
      Engine.populateVariable('queen_was_captured', 'e1', {
        instance,
        board,
        color: 'b',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(0);
  });

  test('should populate is_in_check', () => {
    const board = new Chess(
      'rnb1k1nr/pppp1ppp/4p3/8/1b1PP2q/8/PPP1QPPP/RNB1KBNR w KQkq - 3 4',
    );
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('is_in_check', 'e2', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
  });

  test('should populate is_in_checkmate', () => {
    const board = new Chess(
      'rnbq1rk1/2ppnpQp/1p6/p2P4/2P1p3/5N2/PB2PPPP/RN2KB1R b KQ - 0 9',
    );
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('is_in_checkmate', 'g8', {
        instance,
        board,
        color: 'b',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
  });

  test('should populate possible_moves', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('possible_moves', 'e2', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(2);
  });

  test('should populate knight_can_move_here', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('knight_can_move_here', 'f3', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
  });

  test('should populate knight_can_move_here', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('knight_can_move_here', 'c3', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
    expect(
      Engine.populateVariable('knight_can_move_here', 'f3', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
  });

  test('should populate castled_king_side', () => {
    const board = new Chess(
      'rnbqkbnr/pp3ppp/2ppp3/8/8/5NP1/PPPPPPBP/RNBQK2R w KQkq - 0 4',
    );
    const instance = Engine.initializeNewInstance();

    board.move({ from: 'e1', to: 'g1' });

    expect(
      Engine.populateVariable('castled_king_side', 'g1', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
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
      Engine.populateVariable('is_draw', 'g1', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(1);
  });

  test('should allow pawn capture', () => {
    const board = new Chess(
      'rnbqkbnr/pp1p1ppp/8/2p1p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1',
    );
    const instance = Engine.initializeNewInstance();

    expect(
      Engine.populateVariable('can_capture', 'd4', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(2);
    expect(
      Engine.populateVariable('can_capture_pawn', 'd4', {
        instance,
        board,
        color: 'w',
        outputs,
        depth: 0,
      }).value,
    ).toEqual(2);
  });
});

describe('executing an algorithm', () => {
  const outputs = {
    firstIterationPreMoveTotal: 0,
    firstIterationPostMoveTotal: 0,
    prevIterationPreMoveTotal: 0,
    prevIterationPostMoveTotal: 0,
    thisIterationPreMoveTotal: 0,
    thisIterationPostMoveTotal: 0,
  };

  test('should return addition', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();
    instance.boardAlgorithm.rootToken = {
      id: 'add',
      args: [
        { id: 'custom_1' },
        {
          id: 'sub',
          args: [{ id: 'custom_2' }, { id: 'is_in_check' }],
        },
      ],
    };
    instance.memory[1].value = 1;
    instance.memory[2].value = 2;

    const result = Engine.execAlgorithm(instance.boardAlgorithm, 'a1', {
      instance,
      board,
      color: 'w',
      outputs,
      depth: 0,
    });

    expect(result).toEqual(3);
  });

  test('should return comparison', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();
    instance.boardAlgorithm.rootToken = {
      id: 'eq',
      args: [{ id: 'custom_1' }, { id: 'custom_2' }],
    };
    instance.memory[1].value = 1;
    instance.memory[2].value = 2;

    const result = Engine.execAlgorithm(instance.boardAlgorithm, 'a1', {
      instance,
      board,
      color: 'w',
      outputs,
      depth: 0,
    });

    expect(result).toEqual(0);
  });

  test('should return if conditional', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();
    instance.boardAlgorithm.rootToken = {
      id: 'if',
      condition: { id: 'is_in_check' },
      then: { id: 'custom_1' },
      else: { id: 'custom_2' },
    };
    instance.memory[1].value = 1;
    instance.memory[2].value = 2;

    const result = Engine.execAlgorithm(instance.boardAlgorithm, 'a1', {
      instance,
      board,
      color: 'w',
      outputs,
      depth: 0,
    });

    expect(result).toEqual(2);
  });

  test('should write to memory', () => {
    const board = new Chess();
    const instance = Engine.initializeNewInstance();
    instance.boardAlgorithm.rootToken = {
      id: 'write',
      value: {
        id: 'invert',
        value: { id: 'is_in_check' },
      },
      memoryIndex: 2,
    };
    instance.memory[1].value = -1;

    Engine.execAlgorithm(instance.boardAlgorithm, 'a1', {
      instance,
      board,
      color: 'w',
      outputs,
      depth: 0,
    });

    expect(instance.memory[2].value).toEqual(1);
  });
});

// describe('comparing algorithms', () => {
// 	test('should not crash', async () => {
// 		testManyTimes(() => {
// 			const instance = Engine.initializeNewInstance();
// 			const instance2 = Engine.initializeNewInstance();

// 			expect(
// 				Engine.compareInstances([instance, instance2]),
// 			).resolves.toBeDefined();
// 		}, 10);
// 	});
// });
