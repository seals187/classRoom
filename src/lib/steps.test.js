import { describe, expect, it } from 'vitest';
import { countByStep } from './steps.js';

describe('countByStep', () => {
	it('zählt pro Schritt, Ziele ohne Schritt nicht; spätere Listen gewinnen', () => {
		const self = [{ goals: [{ stepKey: 'a', done: true }] }];
		const lesson = [
			{ goals: [{ stepKey: 'a', done: true }, { stepKey: null, done: true }] },
			{ goals: [{ stepKey: 'a', done: false }, { stepKey: 'b', done: false }] }
		];
		expect(countByStep(self, lesson)).toEqual({ a: { done: 1, total: 2 }, b: { done: 0, total: 1 } });
		expect(countByStep(self)).toEqual({ a: { done: 1, total: 1 } });
	});
});
