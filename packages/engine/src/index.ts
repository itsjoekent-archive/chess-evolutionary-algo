import { Chess } from 'chess.js';
import random from 'lodash/random';
import set from 'lodash/set';
import * as ChessHelpers from './chess-helpers';
import * as EngineConstants from './constants';
import * as EngineTypes from './types';
import * as EngineUtils from './utils';

export function generateRandomToken(
	parent: EngineTypes.AllPossibleTokenIds | null = null,
	iterationCount: number = 0,
): EngineTypes.Token {
	let tokenId: EngineTypes.FunctionTokenIds | EngineTypes.VariableId;

	const functionBias =
		parent === null
			? 1
			: iterationCount >= EngineConstants.MAX_TOKEN_DEPTH_PER_ITERATION
				? 0
				: EngineUtils.isFunctionId(parent)
					? 0.4
					: 0.6;

	const randomValue = random(0, 1, true);
	if (randomValue <= functionBias) {
		tokenId =
			EngineConstants.FUNCTION_TOKEN_IDS[
				random(0, EngineConstants.FUNCTION_TOKEN_IDS.length - 1, false)
			];
	} else {
		tokenId =
			EngineConstants.VARIABLE_IDS[
				random(0, EngineConstants.VARIABLE_IDS.length - 1, false)
			];
	}

	if (EngineUtils.isVariableId(tokenId)) {
		return { id: tokenId as EngineTypes.VariableId };
	}

	function generateSubToken() {
		return generateRandomToken(tokenId, iterationCount + 1);
	}

	switch (tokenId) {
		case 'add':
		case 'sub':
		case 'mul':
		case 'div':
		case 'mod':
		case 'and':
		case 'or': {
			return {
				id: tokenId,
				args: [generateSubToken(), generateSubToken()],
			};
		}

		case 'binary':
		case 'sqrt':
		case 'round':
		case 'floor':
		case 'ceil':
		case 'abs': {
			return {
				id: tokenId,
				value: generateSubToken(),
			};
		}

		case 'gt':
		case 'gte':
		case 'lt':
		case 'lte': {
			return {
				id: tokenId,
				left: generateSubToken(),
				right: generateSubToken(),
			};
		}

		case 'min':
		case 'max':
		case 'eq':
		case 'neq': {
			const length = EngineUtils.randomBoxMuller(
				2,
				EngineConstants.MAX_TOKEN_DYNAMIC_ARGS_LENGTH,
				3,
			);

			return {
				id: tokenId,
				args: Array.from({ length }, () => generateSubToken()),
			};
		}

		case 'pow': {
			return {
				id: tokenId,
				base: generateSubToken(),
				power: generateSubToken(),
			};
		}

		case 'if': {
			return {
				id: tokenId,
				condition: generateSubToken(),
				then: generateSubToken(),
				else: generateSubToken(),
			};
		}

		case 'write': {
			const memoryIndex = random(0, EngineConstants.MEMORY_SIZE - 1, false);

			return {
				id: tokenId,
				memoryIndex,
				value: generateSubToken(),
			};
		}

		default:
			return EngineUtils.assertUnreachable(tokenId);
	}
}

export function walkAlgorithmTokens(
	algorithm: EngineTypes.ChessAlgorithm,
	callback: (
		parent: EngineTypes.Token | null,
		token: EngineTypes.Token,
		done: (replacer?: EngineTypes.Token) => void,
	) => void,
	shuffle: boolean = false,
) {
	let hasCompleted = false;

	function step(
		parent: EngineTypes.Token | null,
		token: EngineTypes.Token,
		path: string,
	) {
		if (hasCompleted) return;

		const done = (replacer?: EngineTypes.Token) => {
			hasCompleted = true;

			if (replacer) {
				if (!path) algorithm.rootToken = replacer;
				else set(algorithm.rootToken, path, replacer);
			}
		};

		callback(parent, token, done);

		if (hasCompleted) return;

		if (EngineUtils.isVariableId(token.id)) {
			return;
		}

		const tokenChildKeysWithoutId = Object.keys(token).filter(
			(key) => key !== 'id',
		);

		const tokenChildKeys = shuffle
			? EngineUtils.shuffle(tokenChildKeysWithoutId)
			: tokenChildKeysWithoutId;

		for (const key of tokenChildKeys) {
			const value = token[key as keyof EngineTypes.Token] as any;

			if (Array.isArray(value)) {
				const tokenList = shuffle ? EngineUtils.shuffle(value) : value;
				for (let i = 0; i < tokenList.length; i++) {
					const subtoken = tokenList[i];

					if (
						EngineUtils.isVariableId(subtoken?.id) ||
						EngineUtils.isFunctionId(subtoken?.id)
					) {
						step(
							token,
							EngineUtils.dangerousTokenAssertion(subtoken),
							EngineUtils.dotJoin(path, `${key}[${i}]`),
						);
					}
				}
			} else {
				if (
					EngineUtils.isVariableId(value?.id) ||
					EngineUtils.isFunctionId(value?.id)
				) {
					step(
						token,
						EngineUtils.dangerousTokenAssertion(value),
						EngineUtils.dotJoin(path, key),
					);
				}
			}
		}
	}

	step(null, algorithm.rootToken, '');
}

export function initializeNewAlgorithm(): EngineTypes.ChessAlgorithm {
	const memory: EngineTypes.CustomVariable[] = [];

	for (let i = 0; i < EngineConstants.STATIC_MEMORY_SIZE; i++) {
		memory.push({
			id: `custom_${i}`,
			index: i,
			value: random(
				EngineConstants.CUSTOM_VARIABLE_MIN,
				EngineConstants.CUSTOM_VARIABLE_MAX,
			),
		});
	}

	for (let i = 0; i < EngineConstants.DYNAMIC_MEMORY_SIZE; i++) {
		memory.push({
			id: `custom_${EngineConstants.STATIC_MEMORY_SIZE + i}`,
			index: i + EngineConstants.STATIC_MEMORY_SIZE,
			value: 0,
		});
	}

	return {
		rootToken: generateRandomToken(),
		memory,
	};
}

export function mutateAlgorithm(
	algorithm: EngineTypes.ChessAlgorithm,
): EngineTypes.MutationResult {
	const rootTokenStringified = JSON.stringify(algorithm.rootToken);
	const newAlgorithm = EngineUtils.cloneAlgorithm(algorithm);

	const totalTokenMutations = random(1, 4, false);
	const totalMemoryMutations = random(1, 4, false);

	const memoryMutations: EngineTypes.MutationResult['memoryMutations'] = {};
	const tokenMutations: EngineTypes.MutationResult['tokenMutations'] = [];

	let memoryAttempts = 0;
	while (
		memoryAttempts < 1000 &&
		Object.keys(memoryMutations).length < totalMemoryMutations
	) {
		const randomIndex = random(
			0,
			EngineConstants.STATIC_MEMORY_SIZE - 1,
			false,
		);

		if (memoryMutations[`custom_${randomIndex}`]) {
			memoryAttempts++;
			continue;
		}

		const newMemoryValue = random(
			EngineConstants.CUSTOM_VARIABLE_MIN,
			EngineConstants.CUSTOM_VARIABLE_MAX,
		);

		if (newAlgorithm.memory[randomIndex].value !== newMemoryValue) {
			newAlgorithm.memory[randomIndex].value = newMemoryValue;

			memoryMutations[`custom_${randomIndex}`] =
				newAlgorithm.memory[randomIndex].value;
		}

		memoryAttempts++;
	}

	let tokenAttempts = 0;
	while (tokenAttempts < 1000 && tokenMutations.length < totalTokenMutations) {
		const tempAlgorithm = EngineUtils.cloneAlgorithm(newAlgorithm);

		let algorithmTokenCount = 0;
		walkAlgorithmTokens(tempAlgorithm, () => algorithmTokenCount++);

		let walks = 0;
		let mutationToken: EngineTypes.Token | null = null;

		walkAlgorithmTokens(
			tempAlgorithm,
			(parent, token, done) => {
				walks++;
				const percentWalked = walks / algorithmTokenCount;

				if (!!parent && random(0, 1, true) <= percentWalked) {
					const mutation = generateRandomToken(token.id, 0);
					mutationToken = mutation;
					done(mutation);
				}
			},
			true,
		);

		if (
			mutationToken &&
			JSON.stringify(tempAlgorithm.rootToken) !== rootTokenStringified
		) {
			tokenMutations.push(mutationToken);
			newAlgorithm.rootToken = tempAlgorithm.rootToken;
		}

		tokenAttempts++;
	}

	return {
		algorithm: newAlgorithm,
		memoryMutations,
		tokenMutations,
	};
}

export function evolveAlgorithm(
	algorithm: EngineTypes.ChessAlgorithm,
	totalOffspring: number,
): EngineTypes.MutationResult[] {
	const loopTarget = totalOffspring + 1;

	const seed = EngineUtils.cloneAlgorithm(algorithm);
	EngineUtils.clearDynamicMemory(seed);

	const offspring: EngineTypes.MutationResult[] = [
		{
			algorithm: seed,
			tokenMutations: [],
			memoryMutations: {},
		},
	];

	const reserves = new Set([JSON.stringify(algorithm)]);

	let attempts = 0;
	while (attempts < loopTarget * 10 && offspring.length < loopTarget) {
		const mutation = mutateAlgorithm(seed);
		const mutationStringified = JSON.stringify(mutation.algorithm);

		if (!reserves.has(mutationStringified)) {
			offspring.push(mutation);
			reserves.add(mutationStringified);
		}

		attempts++;
	}

	return offspring;
}

export function populateVariable(
	variableId: EngineTypes.VariableId,
	algorithm: EngineTypes.ChessAlgorithm,
	board: Chess,
	square: EngineTypes.Square,
	selfColor: EngineTypes.Color,
): EngineTypes.Variable {
	if (variableId.startsWith('custom_')) {
		throw new Error();
	}

  const oppositeColor: EngineTypes.Color = selfColor === 'b' ? 'w' : 'b';

	switch (variableId) {
		case 'adjacent_empty_squares':
			throw new Error();
		case 'adjacent_friendly_bishops':
			throw new Error();
		case 'adjacent_friendly_king':
			throw new Error();
		case 'adjacent_friendly_knights':
			throw new Error();
		case 'adjacent_friendly_pawns':
			throw new Error();
		case 'adjacent_friendly_pieces':
			throw new Error();
		case 'adjacent_friendly_queens':
			throw new Error();
		case 'adjacent_friendly_rooks':
			throw new Error();
		case 'adjacent_opponent_bishops':
			throw new Error();
		case 'adjacent_opponent_king':
			throw new Error();
		case 'adjacent_opponent_knights':
			throw new Error();
		case 'adjacent_opponent_pawns':
			throw new Error();
		case 'adjacent_opponent_pieces':
			throw new Error();
		case 'adjacent_opponent_queens':
			throw new Error();
		case 'adjacent_opponent_rooks':
			throw new Error();

		case 'can_attack':
			throw new Error();
		case 'can_attack_bishop':
			throw new Error();
		case 'can_attack_king':
			throw new Error();
		case 'can_attack_knight':
			throw new Error();
		case 'can_attack_pawn':
			throw new Error();
		case 'can_attack_queen':
			throw new Error();
		case 'can_attack_rook':
			throw new Error();

		case 'captured_piece':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, { color: oppositeColor }),
				),
			};

		case 'captured_bishop':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: oppositeColor,
						type: ChessHelpers.BISHOP,
					}),
				),
			};

		case 'captured_knight':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: oppositeColor,
						type: ChessHelpers.KNIGHT,
					}),
				),
			};

		case 'captured_pawn':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: oppositeColor,
						type: ChessHelpers.PAWN,
					}),
				),
			};

		case 'captured_queen':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: oppositeColor,
						type: ChessHelpers.QUEEN,
					}),
				),
			};

		case 'captured_rook':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: oppositeColor,
						type: ChessHelpers.ROOK,
					}),
				),
			};

		case 'lost_piece':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, { color: selfColor }),
				),
			};

		case 'lost_bishop':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: selfColor,
						type: ChessHelpers.BISHOP,
					}),
				),
			};

		case 'lost_knight':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: selfColor,
						type: ChessHelpers.KNIGHT,
					}),
				),
			};

		case 'lost_pawn':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: selfColor,
						type: ChessHelpers.PAWN,
					}),
				),
			};

		case 'lost_queen':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: selfColor,
						type: ChessHelpers.QUEEN,
					}),
				),
			};

		case 'lost_rook':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						color: selfColor,
						type: ChessHelpers.ROOK,
					}),
				),
			};

		case 'friendly_bishop_can_move_here':
			throw new Error();
		case 'friendly_king_can_move_here':
			throw new Error();
		case 'friendly_knight_can_move_here':
			throw new Error();
		case 'friendly_pawn_can_move_here':
			throw new Error();
		case 'friendly_queen_can_move_here':
			throw new Error();
		case 'friendly_rook_can_move_here':
			throw new Error();

		case 'is_bishop':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isBishop(board, square)),
			};

		case 'is_king':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isKing(board, square)),
			};

		case 'is_knight':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isKnight(board, square)),
			};

		case 'is_pawn':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isPawn(board, square)),
			};

		case 'is_queen':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isQueen(board, square)),
			};

		case 'is_rook':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isRook(board, square)),
			};

		case 'is_castling': {
			if (!ChessHelpers.isKing(board, square)) {
				return { id: variableId, value: 0 };
			}

			const lastMove = ChessHelpers.getLastMove(board);
			return {
				id: variableId,
				value: EngineUtils.binary(
					lastMove &&
						(lastMove.flags.includes(ChessHelpers.FLAG_KSIDE_CASTLE) ||
							lastMove.flags.includes(ChessHelpers.FLAG_QSIDE_CASTLE)),
				),
			};
		}

		case 'is_in_check':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.isKing(board, square) && board.inCheck(),
				),
			};

		case 'is_in_checkmate':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.isKing(board, square) && board.isCheckmate(),
				),
			};

		case 'is_draw':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.isKing(board, square) && ChessHelpers.isDraw(board),
				),
			};

		case 'is_empty':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.hasPiece(board, square)),
			};

		case 'is_self':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.isPieceColor(board, square, selfColor),
				),
			};

		case 'is_opponent':
			return {
				id: variableId,
				value: EngineUtils.binary(
					!ChessHelpers.isPieceColor(board, square, selfColor),
				),
			};

		case 'possible_moves':
			throw new Error();

		case 'is_under_attack':
			throw new Error();
		case 'is_under_attack_by_bishop':
			throw new Error();
		case 'is_under_attack_by_king':
			throw new Error();
		case 'is_under_attack_by_knight':
			throw new Error();
		case 'is_under_attack_by_pawn':
			throw new Error();
		case 'is_under_attack_by_queen':
			throw new Error();
		case 'is_under_attack_by_rook':
			throw new Error();

		case 'opponent_bishop_can_move_here':
			throw new Error();
		case 'opponent_king_can_move_here':
			throw new Error();
		case 'opponent_knight_can_move_here':
			throw new Error();
		case 'opponent_pawn_can_move_here':
			throw new Error();
		case 'opponent_queen_can_move_here':
			throw new Error();
		case 'opponent_rook_can_move_here':
			throw new Error();

		default:
			throw new Error(`${variableId} was not handled`);
	}
}

export async function evaluateAlgorithm(
	algorithms: [EngineTypes.ChessAlgorithm, EngineTypes.ChessAlgorithm],
): Promise<EngineTypes.EvaluationResult> {
	const chess = new Chess();

	const algorithmsCopy = EngineUtils.shuffle([...algorithms]);

	const evaluationResult: EngineTypes.EvaluationResult = {
		w: {
			fitnessScore: 0,
			algorithm: algorithmsCopy.pop() as EngineTypes.ChessAlgorithm,
		},
		b: {
			fitnessScore: 0,
			algorithm: algorithmsCopy.pop() as EngineTypes.ChessAlgorithm,
		},
	};

	const usedVariables: Record<EngineTypes.Color, EngineTypes.VariableId[]> = {
		w: [],
		b: [],
	};

	(['w', 'b'] as EngineTypes.Color[]).forEach((color) => {
		walkAlgorithmTokens(evaluationResult[color].algorithm, (p, token) => {
			if (EngineUtils.isVariableId(token.id)) {
				usedVariables[color].push(token.id);
			}
		});
	});

	async function playGame(
		resolve: (result: EngineTypes.EvaluationResult) => void,
	) {
		let hasCancelled = false;

		function endGame() {
			if (hasCancelled) return;

			resolve(evaluationResult);
			hasCancelled = true;
		}

		while (!chess.isGameOver() || !hasCancelled) {
			const currentTurnColor: EngineTypes.Color = chess.turn();

			const timeoutId = setTimeout(() => {
				if (!hasCancelled) {
					evaluationResult[currentTurnColor].fitnessScore -=
						EngineConstants.FITNESS_SCORES['TIMEOUT'];
					endGame();
				}
			}, EngineConstants.MAX_ALGORITHM_DURATION_MS);

			// const moves = chess.moves();
			// const move = moves[Math.floor(Math.random() * moves.length)];
			// chess.move(move);

			// wrap algorithm run with try/catch so we can throw if the timeout expires
			// to stop the promise from running

			// check hasCancelled again before writing to evaluationResult

			clearTimeout(timeoutId);
		}

		endGame();
	}

	const { resolve, promise } =
		Promise.withResolvers<EngineTypes.EvaluationResult>();
	await playGame(resolve);

	return promise;
}
