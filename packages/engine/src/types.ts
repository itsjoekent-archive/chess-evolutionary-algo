export type Row = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type Column = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${Row}${Column}`;

export type Color = 'white' | 'black';

export type Piece = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type PieceNoKing = Exclude<Piece, 'king'>;

export type VariableBinaryValue = 0 | 1;
export type VariableRangeValue = number;

// Too lazy to figure out the "smart" way of doing this in TS
// given the use of template literals.
export type StandardVariableIds =
  | 'is_self'
  | 'is_opponent'
  | 'is_empty'
  | `is_${Piece}`
  | 'is_in_check'
  | 'is_in_checkmate'
  | 'is_castling'
  | 'is_stalemate'
  | 'is_under_attack'
  | `is_under_attack_by_${Piece}`
  | 'captured_piece'
  | `captured_${PieceNoKing}`
  | 'lost_piece'
  | `lost_${PieceNoKing}`
  | 'can_attack'
  | `can_attack_${Piece}`
  | 'possible_moves'
  | `friendly_${Piece}_can_move_here`
  | `opponent_${Piece}_can_move_here`
  | 'adjacent_empty_squares'
  | 'adjacent_friendly_pieces'
  | `adjacent_friendly_${PieceNoKing}s`
  | 'adjacent_friendly_king'
  | 'adjacent_opponent_pieces'
  | `adjacent_opponent_${PieceNoKing}s`
  | 'adjacent_opponent_king';

export type CustomVariableId = `custom_${number}`;

export type VariableId = StandardVariableIds | CustomVariableId;

export type StandardVariable =
  | {
      id: 'is_self';
      value: VariableBinaryValue;
    }
  | {
      id: 'is_opponent';
      value: VariableBinaryValue;
    }
  | {
      id: 'is_empty';
      value: VariableBinaryValue;
    }
  | {
      id: `is_${Piece}`;
      value: VariableBinaryValue;
    }
  | {
      id: 'is_in_check';
      value: VariableBinaryValue;
    }
  | {
      id: 'is_in_checkmate';
      value: VariableBinaryValue;
    }
  | {
      id: 'is_castling';
      value: VariableBinaryValue;
    }
  | {
      id: 'is_stalemate';
      value: VariableBinaryValue;
    }
  | {
      id: 'is_under_attack';
      value: VariableRangeValue;
    }
  | {
      id: `is_under_attack_by_${Piece}`;
      value: VariableRangeValue;
    }
  | {
      id: 'captured_piece';
      value: VariableBinaryValue;
    }
  | {
      id: `captured_${PieceNoKing}`;
      value: VariableBinaryValue;
    }
  | {
      id: 'lost_piece';
      value: VariableBinaryValue;
    }
  | {
      id: `lost_${PieceNoKing}`;
      value: VariableBinaryValue;
    }
  | {
      id: 'can_attack';
      value: VariableRangeValue;
    }
  | {
      id: `can_attack_${PieceNoKing}`;
      value: VariableRangeValue;
    }
  | {
      id: 'can_attack_king';
      value: VariableBinaryValue;
    }
  | {
      id: 'possible_moves';
      value: VariableRangeValue;
    }
  | {
      id: `friendly_${Piece}_can_move_here`;
      value: VariableRangeValue;
    }
  | {
      id: `opponent_${Piece}_can_move_here`;
      value: VariableRangeValue;
    }
  | {
      id: 'adjacent_empty_squares';
      value: VariableRangeValue;
    }
  | {
      id: 'adjacent_friendly_pieces';
      value: VariableRangeValue;
    }
  | {
      id: `adjacent_friendly_${PieceNoKing}s`;
      value: VariableRangeValue;
    }
  | {
      id: 'adjacent_friendly_king';
      value: VariableBinaryValue;
    }
  | {
      id: 'adjacent_opponent_pieces';
      value: VariableRangeValue;
    }
  | {
      id: `adjacent_opponent_${PieceNoKing}s`;
      value: VariableRangeValue;
    }
  | {
      id: 'adjacent_opponent_king';
      value: VariableBinaryValue;
    };

export type CustomVariable = {
  id: CustomVariableId;
  index: number;
  value: VariableRangeValue;
};

export type Variable = StandardVariable | CustomVariable;

export type FunctionToken = {
  id: 'add';
  args: [Token, Token];
} | {
  id: 'sub';
  args: [Token, Token];
} | {
  id: 'mul';
  args: [Token, Token];
} | {
  id: 'div';
  args: [Token, Token];
} | {
  id: 'sqrt';
  value: Token;
} | {
  id: 'mod';
  args: [Token, Token];
} | {
  id: 'pow';
  base: Token;
  power: Token;
} | {
  id: 'round';
  value: Token;
} | {
  id: 'floor';
  value: Token;
} | {
  id: 'ceil';
  value: Token;
} | {
  id: 'min';
  args: Token[];
} | {
  id: 'max';
  args: Token[];
} | {
  id: 'abs';
  value: Token;
} | {
  id: 'eq';
  args: Token[];
} | {
  id: 'neq';
  args: Token[];
} | {
  id: 'gt';
  left: Token;
  right: Token;
} | {
  id: 'gte';
  left: Token;
  right: Token;
} | {
  id: 'lt';
  left: Token;
  right: Token;
} | {
  id: 'lte';
  left: Token;
  right: Token;
} | {
  id: 'binary';
  value: Token;
} | {
  id: 'and';
  args: [Token, Token],
} | {
  id: 'or';
  args: [Token, Token],
} | {
  id: 'if';
  condition: Token;
  then: Token;
  else: Token;
} | {
  id: 'write';
  value: Token;
  memoryIndex: number;
};

export type FunctionTokenIds = FunctionToken['id'];

export type AllPossibleTokenIds = FunctionTokenIds | VariableId;

export type VariableToken = { id: VariableId };

export type Token = FunctionToken | VariableToken;

export type ChessAlgorithm = {
  rootToken: Token;
  memory: CustomVariable[];
};
