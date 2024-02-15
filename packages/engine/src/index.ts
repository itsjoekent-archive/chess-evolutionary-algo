import random from 'lodash/random';
import set from 'lodash/set';
import * as EngineConstants from './constants';
import * as EngineTypes from './types';
import * as EngineUtils from './utils';

export function generateRandomToken(parent: EngineTypes.AllPossibleTokenIds | null = null, iterationCount: number = 0): EngineTypes.Token {
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
		tokenId = EngineConstants.FUNCTION_TOKEN_IDS[random(0, EngineConstants.FUNCTION_TOKEN_IDS.length - 1, false)];
	} else {
		tokenId = EngineConstants.VARIABLE_IDS[random(0, EngineConstants.VARIABLE_IDS.length - 1, false)];
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
			const length = EngineUtils.randomBoxMuller(2, EngineConstants.MAX_TOKEN_DYNAMIC_ARGS_LENGTH, 3);

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
	callback: (parent: EngineTypes.Token | null, token: EngineTypes.Token, done: (replacer?: EngineTypes.Token) => void) => void,
	shuffle: boolean = false,
) {
	let hasCompleted = false;

	function step(parent: EngineTypes.Token | null, token: EngineTypes.Token, path: string) {
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

		const tokenChildKeysWithoutId = Object.keys(token).filter((key) => key !== 'id');

		const tokenChildKeys = shuffle ? EngineUtils.shuffle(tokenChildKeysWithoutId) : tokenChildKeysWithoutId;

		for (const key of tokenChildKeys) {
			const value = token[key as keyof EngineTypes.Token] as any;

			if (Array.isArray(value)) {
				const tokenList = shuffle ? EngineUtils.shuffle(value) : value;
				for (let i = 0; i < tokenList.length; i++) {
					const subtoken = tokenList[i];

					if (EngineUtils.isVariableId(subtoken?.id) || EngineUtils.isFunctionId(subtoken?.id)) {
						step(token, EngineUtils.dangerousTokenAssertion(subtoken), EngineUtils.dotJoin(path, `${key}[${i}]`));
					}
				}
			} else {
				if (EngineUtils.isVariableId(value?.id) || EngineUtils.isFunctionId(value?.id)) {
					step(token, EngineUtils.dangerousTokenAssertion(value), EngineUtils.dotJoin(path, key));
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
			value: random(EngineConstants.CUSTOM_VARIABLE_MIN, EngineConstants.CUSTOM_VARIABLE_MAX),
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

type MutationResult = {
	algorithm: EngineTypes.ChessAlgorithm;
	memoryMutations: Record<EngineTypes.CustomVariableId, number>;
	tokenMutations: EngineTypes.Token[];
};

export function mutateAlgorithm(algorithm: EngineTypes.ChessAlgorithm): MutationResult {
	const rootTokenStringified = JSON.stringify(algorithm.rootToken);
	const newAlgorithm = EngineUtils.cloneAlgorithm(algorithm);

	const totalTokenMutations = random(1, 4, false);
	const totalMemoryMutations = random(1, 4, false);

	const memoryMutations: MutationResult['memoryMutations'] = {};
	const tokenMutations: MutationResult['tokenMutations'] = [];

	let memoryAttempts = 0;
	while (memoryAttempts < 1000 && Object.keys(memoryMutations).length < totalMemoryMutations) {
		const randomIndex = random(0, EngineConstants.STATIC_MEMORY_SIZE - 1, false);

		if (memoryMutations[`custom_${randomIndex}`]) {
			memoryAttempts++;
			continue;
		}

		const newMemoryValue = random(EngineConstants.CUSTOM_VARIABLE_MIN, EngineConstants.CUSTOM_VARIABLE_MAX);

		if (newAlgorithm.memory[randomIndex].value !== newMemoryValue) {
			newAlgorithm.memory[randomIndex].value = newMemoryValue;

			memoryMutations[`custom_${randomIndex}`] = newAlgorithm.memory[randomIndex].value;
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

		if (mutationToken && JSON.stringify(tempAlgorithm.rootToken) !== rootTokenStringified) {
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
