import { expect, test, describe } from 'vitest';
import { randomBytes } from 'crypto';
import * as Engine from './index';

describe('mergeAlgorithms', () => {
  test('merge algorithms with only 1 pattern in each algorithm', () => {
    const parentA = Engine.initializeNewAlgorithm('white');
    const parentB = Engine.initializeNewAlgorithm('black');
    const child = Engine.mergeAlgorithms(parentA, parentB);

    expect(child.patterns.length).toBe(2);
  });

  test('merge algorithms with one algorithm only having 1 pattern', () => {
    const parentA = Engine.initializeNewAlgorithm('white');
    parentA.patterns = [
      parentA.patterns[0],
      Engine.initializeNewAlgorithm('white').patterns[0],
      Engine.initializeNewAlgorithm('white').patterns[0],
    ];

    const parentB = Engine.initializeNewAlgorithm('black');
    const child = Engine.mergeAlgorithms(parentA, parentB);

    expect(child.patterns.length).toBe(3);
  });

  test('merge algorithms with both algorithms having more than 1 pattern', () => {
    const parentA = Engine.initializeNewAlgorithm('white');
    parentA.patterns = [
      parentA.patterns[0],
      Engine.initializeNewAlgorithm('white').patterns[0],
      Engine.initializeNewAlgorithm('white').patterns[0],
    ];

    const parentB = Engine.initializeNewAlgorithm('black');
    parentB.patterns = [
      parentB.patterns[0],
      Engine.initializeNewAlgorithm('black').patterns[0],
      Engine.initializeNewAlgorithm('black').patterns[0],
    ];

    const child = Engine.mergeAlgorithms(parentA, parentB);

    expect(child.patterns.length).toBe(3);
  });

  test('merged algorithm should have less than 5000 patterns', () => {
    const parentA = Engine.initializeNewAlgorithm('white');
    for (let i = 0; i < 10000; i++) {
      parentA.patterns.push(Engine.initializeNewAlgorithm('white').patterns[0]);
    }

    const parentB = Engine.initializeNewAlgorithm('black');
    for (let i = 0; i < 10000; i++) {
      parentA.patterns.push(Engine.initializeNewAlgorithm('black').patterns[0]);
    }

    const child = Engine.mergeAlgorithms(parentA, parentB);
    expect(child.patterns.length).toBe(5000);
  });
});

describe('mutateAlgorithm', () => {
  test('mutate algorithm with less than 100 patterns', () => {
    let mismatches: number = 0;

    const algorithm = Engine.initializeNewAlgorithm('white');
    for (let i = 0; i < 50; i++) {
      // @ts-expect-error - Test data
      algorithm.patterns.push({ rnd: randomBytes(128).toString('utf8') });
    }

    const mutatedAlgorithm = Engine.mutateAlgorithm(algorithm);
    expect(JSON.stringify(mutatedAlgorithm)).not.toBe(JSON.stringify(algorithm));
  });

  test('mutate algorithm with more than 100 patterns', () => {
    let mismatches: number = 0;

    const algorithm = Engine.initializeNewAlgorithm('white');
    for (let i = 0; i < 500; i++) {
      // @ts-expect-error - Test data
      algorithm.patterns.push({ rnd: randomBytes(128).toString('utf8') });
    }

    const mutatedAlgorithm = Engine.mutateAlgorithm(algorithm);
    expect(JSON.stringify(mutatedAlgorithm)).not.toBe(
      JSON.stringify(algorithm)
    );
  });
});
