import { Chess, Piece, Square } from 'chess.js';

// https://github.com/jhlywa/chess.js/blob/f39e6272b6e786cec97cbe5bee543d3cc815180e/src/chess.ts#L96-L104
export const FLAG_NORMAL = 'n';
export const FLAG_CAPTURE = 'c';
export const FLAG_BIG_PAWN = 'b';
export const FLAG_EP_CAPTURE = 'e';
export const FLAG_PROMOTION = 'p';
export const FLAG_KSIDE_CASTLE = 'k';
export const FLAG_QSIDE_CASTLE = 'q';

export const PAWN = 'p';
export const KNIGHT = 'n';
export const BISHOP = 'b';
export const ROOK = 'r';
export const QUEEN = 'q';
export const KING = 'k';

export function hasPiece(board: Chess, square: Square) {
	return !!board.get(square);
}

export function isPieceColor(
	board: Chess,
	square: Square,
	color: Piece['color'],
) {
	return !!(board.get(square)?.color === color);
}

export function isPieceType(board: Chess, square: Square, type: Piece['type']) {
	return !!(board.get(square)?.type === type);
}

export function isBishop(board: Chess, square: Square) {
	return isPieceType(board, square, BISHOP);
}

export function isKing(board: Chess, square: Square) {
	return isPieceType(board, square, KING);
}

export function isKnight(board: Chess, square: Square) {
	return isPieceType(board, square, KNIGHT);
}

export function isPawn(board: Chess, square: Square) {
	return isPieceType(board, square, PAWN);
}

export function isQueen(board: Chess, square: Square) {
	return isPieceType(board, square, QUEEN);
}

export function isRook(board: Chess, square: Square) {
	return isPieceType(board, square, ROOK);
}

export function getLastMove(board: Chess) {
	return board.history({ verbose: true }).pop();
}

export function isDraw(board: Chess) {
	return board.isDraw() || board.isStalemate() || board.isThreefoldRepetition();
}

export function checkCapture(
	board: Chess,
	square: Square,
	filters?: {
		color?: Piece['color'];
		type?: Piece['type'];
	},
) {
	const lastMove = getLastMove(board);
	if (!lastMove || lastMove.to !== square) {
		return false;
	}

	if (
		!lastMove.flags.includes(FLAG_CAPTURE) &&
		!lastMove.flags.includes(FLAG_EP_CAPTURE)
	) {
		return false;
	}

	if (!filters) return true;

	const priorBoard = new Chess(lastMove.before);

	if (filters.color && !isPieceColor(priorBoard, square, filters.color)) {
		return false;
	}

	if (filters.type && !isPieceType(priorBoard, square, filters.type)) {
		return false;
	}

	return true;
}

export function filterMoves(
	board: Chess,
	square: Square,
	direction: 'to' | 'from',
	filters?: {
		color?: Piece['color'];
		type?: Piece['type'];
		isCapturing?: boolean;
	},
): number {
	let moveCount: number = 0;
	const moves = board.moves({ verbose: true });

	for (const move of moves) {
		if ((direction === 'to' && move.to === square) || (direction === 'from' && move.from === square)) {
			if (filters?.color && move.color !== filters.color) {
				continue;
			}

			if (filters?.type && move.piece !== filters.type) {
				continue;
			}

			if (filters?.isCapturing && !hasPiece(board, move.to)){
				continue;
			}

			moveCount++;
		}
	}

	return moveCount;
}
