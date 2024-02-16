import { Chess } from 'chess.js';
import random from 'lodash/random';
import set from 'lodash/set';
import { v4 as uuid } from 'uuid';
import * as ChessHelpers from './chess-helpers';
import * as EngineConstants from './constants';
import * as EngineTypes from './types';
import * as EngineUtils from './utils';

export function generateRandomToken(
	parent: EngineTypes.AllPossibleTokenIds | null = null,
	algorithmType: EngineTypes.ChessAlgorithm['type'],
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
		const variablePool =
			algorithmType === 'board'
				? EngineConstants.BOARD_ALGORITHM_VARIABLE_IDS
				: EngineConstants.MOVEMENT_ALGORITHM_VARIABLE_IDS;

		tokenId = variablePool[random(0, variablePool.length - 1, false)];
	}

	if (EngineUtils.isVariableId(tokenId)) {
		return { id: tokenId as EngineTypes.VariableId };
	}

	function generateSubToken() {
		return generateRandomToken(tokenId, algorithmType, iterationCount + 1);
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
	callback: (params: {
		done: (replacer?: EngineTypes.Token) => void;
		parent: EngineTypes.Token | null;
		path: string;
		token: EngineTypes.Token;
	}) => void,
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

		callback({ parent, path, token, done });

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

export function initializeNewAlgorithm<
	T extends EngineTypes.ChessAlgorithm['type'],
>(type: T): EngineTypes.ChessAlgorithm & { type: T } {
	return {
		rootToken: generateRandomToken(null, type),
		type,
	};
}

export function initializeNewInstance(): EngineTypes.Instance {
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
		id: uuid(),
		boardAlgorithm: initializeNewAlgorithm('board'),
		movementAlgorithm: initializeNewAlgorithm('movement'),
		memory,
	};
}

export function mutateAlgorithm(algorithm: EngineTypes.ChessAlgorithm): {
	algorithm: EngineTypes.ChessAlgorithm;
	tokenMutations: EngineTypes.Mutation['children'][0]['tokenMutations'];
} {
	const rootTokenStringified = JSON.stringify(algorithm.rootToken);
	const newAlgorithm = EngineUtils.cloneAlgorithm(algorithm);

	let tokenAttempts = 0;
	const totalTokenMutations = random(
		EngineConstants.MIN_MUTATION_RATE,
		EngineConstants.MAX_MUTATION_RATE,
		false,
	);

	const tokenMutations: EngineTypes.Mutation['children'][0]['tokenMutations'] =
		[];

	while (tokenAttempts < 1000 && tokenMutations.length < totalTokenMutations) {
		const tempAlgorithm = EngineUtils.cloneAlgorithm(newAlgorithm);

		let algorithmTokenCount = 0;
		walkAlgorithmTokens(tempAlgorithm, () => algorithmTokenCount++);

		let walks = 0;
		let tokenMutationData:
			| EngineTypes.Mutation['children'][0]['tokenMutations'][0]
			| null = null;

		walkAlgorithmTokens(
			tempAlgorithm,
			({ parent, path, token, done }) => {
				walks++;
				const percentWalked = walks / algorithmTokenCount;

				if (!!parent && random(0, 1, true) <= percentWalked) {
					const mutation = generateRandomToken(token.id, tempAlgorithm.type, 0);
					tokenMutationData = {
						path,
						from: token,
						to: mutation,
					};
					done(mutation);
				}
			},
			true,
		);

		if (
			tokenMutationData &&
			JSON.stringify(tempAlgorithm.rootToken) !== rootTokenStringified
		) {
			tokenMutations.push(tokenMutationData);
			newAlgorithm.rootToken = tempAlgorithm.rootToken;
		}

		tokenAttempts++;
	}

	return {
		algorithm: newAlgorithm,
		tokenMutations,
	};
}

export function mutateStaticMemory(instance: EngineTypes.Instance): {
	memory: EngineTypes.Instance['memory'];
	memoryMutations: EngineTypes.Mutation['children'][0]['memoryMutations'];
} {
	const clone = EngineUtils.cloneInstance(instance);
	const memoryMutations: EngineTypes.Mutation['children'][0]['memoryMutations'] =
		[];

	let memoryAttempts = 0;
	const totalMemoryMutations = random(
		EngineConstants.MIN_MUTATION_RATE,
		EngineConstants.MAX_MUTATION_RATE,
		false,
	);

	while (
		memoryAttempts < 1000 &&
		memoryMutations.length < totalMemoryMutations
	) {
		const randomIndex = random(
			0,
			EngineConstants.STATIC_MEMORY_SIZE - 1,
			false,
		);

		const variableName =
			`custom_${randomIndex}` as EngineTypes.CustomVariableId;
		const match = memoryMutations.find((m) => m.variableName === variableName);

		if (match) {
			memoryAttempts++;
			continue;
		}

		const newMemoryValue = random(
			EngineConstants.CUSTOM_VARIABLE_MIN,
			EngineConstants.CUSTOM_VARIABLE_MAX,
		);

		if (clone.memory[randomIndex].value !== newMemoryValue) {
			clone.memory[randomIndex].value = newMemoryValue;

			memoryMutations.push({
				variableName,
				from: clone.memory[randomIndex].value,
				to: newMemoryValue,
			});
		}

		memoryAttempts++;
	}

	return {
		memory: clone.memory,
		memoryMutations,
	};
}

export function evolveInstance(
	instance: EngineTypes.Instance,
	totalOffspring: number,
): EngineTypes.Mutation {
	const loopTarget = totalOffspring + 1;

	const parentInstanceClone = EngineUtils.cloneInstance(instance);
	EngineUtils.clearDynamicMemory(parentInstanceClone);

	const mutationResult: EngineTypes.Mutation = {
		parent: instance,
		children: [
			{
				instance: {
					...parentInstanceClone,
					id: uuid(),
				},
				tokenMutations: [],
				memoryMutations: [],
			},
		],
	};

	const denylist = new Set([EngineUtils.hashInstance(instance)]);

	let attempts = 0;
	while (attempts < loopTarget * 10 && mutationResult.children.length < loopTarget) {
		const boardMutation = mutateAlgorithm(instance.boardAlgorithm);
		const movementMutation = mutateAlgorithm(instance.movementAlgorithm);
		const memoryMutation = mutateStaticMemory(instance);

		const childInstance: EngineTypes.Instance = {
			id: uuid(),
			// @ts-ignore
			boardAlgorithm: boardMutation.algorithm,
			// @ts-ignore
			movementAlgorithm: movementMutation.algorithm,
			memory: memoryMutation.memory,
		};

		const childInstanceHash = EngineUtils.hashInstance(childInstance);
		if (!denylist.has(childInstanceHash)) {
			EngineUtils.clearDynamicMemory(childInstance);
			denylist.add(childInstanceHash);

			mutationResult.children.push({
				instance: childInstance,
				tokenMutations: [
					...boardMutation.tokenMutations,
					...movementMutation.tokenMutations,
				],
				memoryMutations: memoryMutation.memoryMutations,
			});			
		}

		attempts++;
	}

	return mutationResult;
}

export function populateVariable(
	variableId: EngineTypes.VariableId,
	instance: EngineTypes.Instance,
	board: Chess,
	square: EngineTypes.Square,
	selfColor: EngineTypes.Color,
): EngineTypes.Variable {
	if (variableId.startsWith('custom_')) {
		return instance.memory.find(
			(m) => m.id === variableId,
		) as EngineTypes.Variable;
	}

	const opponentColor: EngineTypes.Color = selfColor === 'b' ? 'w' : 'b';

	switch (variableId) {
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
					ChessHelpers.isPieceColor(board, square, opponentColor),
				),
			};

		case 'is_empty':
			return {
				id: variableId,
				value: EngineUtils.binary(!ChessHelpers.hasPiece(board, square)),
			};

		case 'is_pawn':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isPawn(board, square)),
			};

		case 'is_knight':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isKnight(board, square)),
			};

		case 'is_bishop':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isBishop(board, square)),
			};

		case 'is_rook':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isRook(board, square)),
			};

		case 'is_queen':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isQueen(board, square)),
			};

		case 'is_king':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isKing(board, square)),
			};

		case 'is_in_check':
			return {
				id: variableId,
				value: EngineUtils.binary(board.inCheck()),
			};

		case 'is_in_checkmate':
			return {
				id: variableId,
				value: EngineUtils.binary(board.isCheckmate()),
			};

		case 'is_draw':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.isDraw(board)),
			};

		case 'castled_king_side':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.hasCastled(board, square, 'kingside'),
				),
			};

		case 'castled_queen_side':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.hasCastled(board, square, 'queenside'),
				),
			};

		case 'was_captured':
			return {
				id: variableId,
				value: EngineUtils.binary(ChessHelpers.checkCapture(board, square)),
			};

		case 'pawn_was_captured':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						type: ChessHelpers.PAWN,
					}),
				),
			};

		case 'knight_was_captured':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						type: ChessHelpers.KNIGHT,
					}),
				),
			};

		case 'bishop_was_captured':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						type: ChessHelpers.BISHOP,
					}),
				),
			};

		case 'rook_was_captured':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						type: ChessHelpers.ROOK,
					}),
				),
			};

		case 'queen_was_captured':
			return {
				id: variableId,
				value: EngineUtils.binary(
					ChessHelpers.checkCapture(board, square, {
						type: ChessHelpers.QUEEN,
					}),
				),
			};

		case 'possible_moves':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, { fromSquare: square }),
			};

		case 'can_capture':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					fromSquare: square,
					isCapturing: true,
				}),
			};

		case 'can_capture_pawn':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					fromSquare: square,
					isCapturing: ChessHelpers.PAWN,
				}),
			};

		case 'can_capture_knight':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					fromSquare: square,
					isCapturing: ChessHelpers.KNIGHT,
				}),
			};

		case 'can_capture_bishop':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					fromSquare: square,
					isCapturing: ChessHelpers.BISHOP,
				}),
			};

		case 'can_capture_rook':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					fromSquare: square,
					isCapturing: ChessHelpers.ROOK,
				}),
			};

		case 'can_capture_queen':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					fromSquare: square,
					isCapturing: ChessHelpers.QUEEN,
				}),
			};

		case 'can_move_here':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					toSquare: square,
				}),
			};

		case 'pawn_can_move_here':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					toSquare: square,
					type: ChessHelpers.PAWN,
				}),
			};

		case 'knight_can_move_here':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					toSquare: square,
					type: ChessHelpers.KNIGHT,
				}),
			};

		case 'bishop_can_move_here':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					toSquare: square,
					type: ChessHelpers.BISHOP,
				}),
			};

		case 'rook_can_move_here':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					toSquare: square,
					type: ChessHelpers.ROOK,
				}),
			};

		case 'queen_can_move_here':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					toSquare: square,
					type: ChessHelpers.QUEEN,
				}),
			};

		case 'king_can_move_here':
			return {
				id: variableId,
				value: ChessHelpers.filterMoves(board, {
					toSquare: square,
					type: ChessHelpers.KING,
				}),
			};

		default:
			throw new Error(`${variableId} was not handled`);
	}
}

export async function compareInstances(
	instances: [EngineTypes.Instance, EngineTypes.Instance],
): Promise<EngineTypes.EvaluationResult> {
	const chess = new Chess();

	const instancesOrder= EngineUtils.shuffle([...instances]);

	const evaluationResult: EngineTypes.EvaluationResult = {
		[instancesOrder[0].id]: {
			fitnessScore: 0,
			color: 'w',
		},
		[instancesOrder[1].id]: {
			fitnessScore: 0,
			color: 'b',
		},
	};

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
