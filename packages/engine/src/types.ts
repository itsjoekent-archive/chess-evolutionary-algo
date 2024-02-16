export type Row = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Column = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${Row}${Column}`;

export type Color = 'w' | 'b';

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
	| 'is_draw'
	| 'castled_king_side'
	| 'castled_queen_side'
	| 'was_captured'
	| `${PieceNoKing}_was_captured`
	| 'possible_moves'
	| 'can_capture'
	| `can_capture_${PieceNoKing}`
	| 'can_move_here'
	| `${Piece}_can_move_here`
	| 'depth'
	| 'first_iteration_pre_move_total'
	| 'first_iteration_post_move_total'
	| 'prev_iteration_pre_move_total'
	| 'prev_iteration_post_move_total'
	| 'this_iteration_pre_move_total'
	| 'this_iteration_post_move_total';

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
			id: 'is_draw';
			value: VariableBinaryValue;
	  }
	| {
			id: 'castled_king_side';
			value: VariableBinaryValue;
	  }
	| {
			id: 'castled_queen_side';
			value: VariableBinaryValue;
	  }
	| {
			id: 'was_captured';
			value: VariableBinaryValue;
	  }
	| {
			id: `${PieceNoKing}_was_captured`;
			value: VariableBinaryValue;
	  }
	| {
			id: 'possible_moves';
			value: VariableRangeValue;
	  }
	| {
			id: 'can_capture';
			value: VariableRangeValue;
	  }
	| {
			id: `can_capture_${Piece}`;
			value: VariableRangeValue;
	  }
	| {
			id: 'can_move_here';
			value: VariableRangeValue;
	  }
	| {
			id: `${Piece}_can_move_here`;
			value: VariableRangeValue;
	  }
	| {
			id: 'depth';
			value: VariableRangeValue;
	  }
	| {
			id: 'first_iteration_pre_move_total';
			value: VariableRangeValue;
	  }
	| {
			id: 'first_iteration_post_move_total';
			value: VariableRangeValue;
	  }
	| {
			id: 'prev_iteration_pre_move_total';
			value: VariableRangeValue;
	  }
	| {
			id: 'prev_iteration_post_move_total';
			value: VariableRangeValue;
	  }
	| {
			id: 'this_iteration_pre_move_total';
			value: VariableRangeValue;
	  }
	| {
			id: 'this_iteration_post_move_total';
			value: VariableRangeValue;
	  };

export type CustomVariable = {
	id: CustomVariableId;
	index: number;
	value: VariableRangeValue;
};

export type Variable = StandardVariable | CustomVariable;

export type FunctionToken =
	| {
			id: 'add';
			args: [Token, Token];
	  }
	| {
			id: 'sub';
			args: [Token, Token];
	  }
	| {
			id: 'mul';
			args: [Token, Token];
	  }
	| {
			id: 'div';
			args: [Token, Token];
	  }
	| {
			id: 'sqrt';
			value: Token;
	  }
	| {
			id: 'mod';
			args: [Token, Token];
	  }
	| {
			id: 'pow';
			base: Token;
			power: Token;
	  }
	| {
			id: 'round';
			value: Token;
	  }
	| {
			id: 'floor';
			value: Token;
	  }
	| {
			id: 'ceil';
			value: Token;
	  }
	| {
			id: 'min';
			args: Token[];
	  }
	| {
			id: 'max';
			args: Token[];
	  }
	| {
			id: 'abs';
			value: Token;
	  }
	| {
			id: 'eq';
			args: Token[];
	  }
	| {
			id: 'neq';
			args: Token[];
	  }
	| {
			id: 'gt';
			left: Token;
			right: Token;
	  }
	| {
			id: 'gte';
			left: Token;
			right: Token;
	  }
	| {
			id: 'lt';
			left: Token;
			right: Token;
	  }
	| {
			id: 'lte';
			left: Token;
			right: Token;
	  }
	| {
			id: 'binary';
			value: Token;
	  }
	| {
			id: 'and';
			args: [Token, Token];
	  }
	| {
			id: 'or';
			args: [Token, Token];
	  }
	| {
			id: 'if';
			condition: Token;
			then: Token;
			else: Token;
	  }
	| {
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

export type MutationResult = {
	algorithm: ChessAlgorithm;
	memoryMutations: Record<CustomVariableId, number>;
	tokenMutations: Token[];
};

export type EvaluationResult = Record<
	Color,
	{
		algorithm: ChessAlgorithm;
		fitnessScore: number;
	}
>;
