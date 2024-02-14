type Row = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
type Column = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
type Square = `${Row}${Column}`;

type Color = 'white' | 'black';

type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
type PieceList = PieceType[];

type Condition =
  | {
      type: 'is-position';
      position: Square;
    }
  | {
      type: 'is-piece';
      piece: PieceType;
    }
  | {
      type: 'piece-includes';
      pieces: PieceList;
    }
  | {
      type: 'is-piece-color';
      color: Color;
    }
  | {
      type: 'is-empty';
    }
  | {
      type: 'is-player-color';
      color: Color | 'any';
    };

type Match = (
  | {
      type: 'absolute';
      position: Square;
      conditions: Condition[];
    }
  | {
      type: 'relative';
      steps: {
        direction: 'north' | 'south' | 'east' | 'west' | 'north-east' | 'north-west' | 'south-east' | 'south-west';
        distance: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'min' | 'max';
      }[];
    }
);

export type Pattern = {
  matches: Match[];
  move: {
    from: number;
    to: number;
  };
};

type Algorithm = {
  patterns: Pattern[];
};

export function initializeNewAlgorithm(color: Color): Algorithm {
  const from: Square = `D${color === 'white' ? '2' : '7'}`;
  const to: Square = `D${color === 'white' ? '4' : '5'}`;

  return {
    patterns: [
      {
        matches: [
          {
            type: 'absolute',
            position: from,
            conditions: [
              { type: 'is-piece-color', color: color },
              { type: 'is-piece', piece: 'pawn' },
            ],
          },
          {
            type: 'absolute',
            position: to,
            conditions: [{ type: 'is-empty' }],
          },
        ],
        move: {
          from: 0,
          to: 1,
        },
      },
    ],
  };
}

export function mergeAlgorithms(parentA: Algorithm, parentB: Algorithm): Algorithm {
  const child: Algorithm = { patterns: [] };

  function extract(from: Algorithm, offset: 0 | 1 = 0) {
    for (let i = offset; i < from.patterns.length; i += 2) {
      const pattern = from.patterns[i];
      if (pattern) {
        child.patterns.push(pattern);
      }
    }
  }

  function limit(from: Algorithm): Algorithm {
    return {
      ...from,
      patterns: from.patterns.slice(0, 5000),
    };
  }

  if (parentA.patterns.length <= 1) {
    child.patterns.push(parentA.patterns[0]);

    if (parentB.patterns.length > 1) {
      extract(parentB, 0);
      return limit(child);
    }
  }

  if (parentB.patterns.length <= 1) {
    child.patterns.push(parentB.patterns[0]);

    if (parentA.patterns.length > 1) {
      extract(parentA, 0);
      return limit(child);
    }
  }

  if (parentA.patterns.length > 1 && parentB.patterns.length > 1) {
    const [even, odd] =
      Math.random() > 0.5 ? [parentA, parentB] : [parentB, parentA];

    extract(even, 0);
    extract(odd, 1);
  }

  return limit(child);
}

export function mutateAlgorithm(algorithm: Algorithm): Algorithm {
  const totalPatterns = algorithm.patterns.length;
  const totalMutations = Math.max(1, Math.floor(totalPatterns * 0.01));
  const mutatedAlgorithm = JSON.parse(JSON.stringify(algorithm)) as Algorithm;

  for (let i = 0; i < totalMutations; i++) {
    const fromIndex = Math.floor(Math.random() * totalPatterns);
    const toIndex = Math.floor(Math.random() * totalPatterns);

    const pattern = mutatedAlgorithm.patterns.splice(fromIndex, 1)[0];
    mutatedAlgorithm.patterns.splice(toIndex, 0, pattern);
  }

  return mutatedAlgorithm;
}

export function createNewPatternFromBoard(board: string, algorithm: Algorithm, side: Color): Pattern {
  

  // Get list of possible moves
  //  -> Encode this into the pattern
  // Pick random assortment of other pieces on the board
  //  -> Encode this into the pattern

  throw new Error('Not implemented');
}

export function trainAlgorithm(algorithm: Algorithm): number {
  throw new Error('Not implemented');
}
