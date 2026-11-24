import { describe, expect, it } from 'vitest';
import { bigRemaining, lessonState, planLesson } from './lesson.js';

const limits = { warnMinutes: 5, goMinutes: 3 };
/** @param {string} hhmm */
const at = (hhmm) => new Date(`2026-11-24T${hhmm}:00`);
const lesson = (/** @type {string} */ startTime, /** @type {string} */ returnTime) => ({ startTime, returnTime });

describe('lessonState – Phasen', () => {
	const l = lesson('10:00', '10:45');
	it.each([
		['09:50', 'before', false],
		['10:00', 'work', true],
		['10:39', 'work', true],
		['10:40', 'soon', true],
		['10:42', 'go', true],
		['10:45', 'over', true],
		['10:59', 'over', true],
		['11:00', 'none', false]
	])('um %s: %s', (time, phase, running) => {
		const s = lessonState(l, limits, at(time));
		expect(s.phase).toBe(phase);
		expect(s.running).toBe(running);
	});

	it('ohne Ende keine Stunde', () => {
		expect(lessonState(lesson('10:00', ''), limits, at('10:10')).phase).toBe('none');
		expect(lessonState(lesson('', ''), limits, at('10:10')).phase).toBe('none');
	});

	it('nur ein Ende (z. B. Standardzeit aus der .env) läuft bis dahin', () => {
		const s = lessonState(lesson('', '10:45'), limits, at('10:10'));
		expect(s.phase).toBe('work');
		expect(s.progress).toBe(0);
	});

	it('über Mitternacht', () => {
		const l2 = lesson('23:30', '00:15');
		expect(lessonState(l2, limits, new Date('2026-11-24T23:50:00')).phase).toBe('work');
		expect(lessonState(l2, limits, new Date('2026-11-25T00:12:00')).phase).toBe('go');
		expect(lessonState(l2, limits, new Date('2026-11-25T00:31:00')).phase).toBe('none');
	});

	it('Restzeit, Fortschritt und Überzug', () => {
		const half = lessonState(l, limits, at('10:30'));
		expect(half.remaining).toBe(15 * 60000);
		expect(half.progress).toBeCloseTo(30 / 45);
		const over = lessonState(l, limits, new Date('2026-11-24T10:52:30'));
		expect(over.progress).toBe(1);
		expect(over.overMinutes).toBe(7);
	});

	it('ohne Aufräumen/Losgehen (0 min) direkt von Arbeit zu Zeit um', () => {
		expect(lessonState(l, { warnMinutes: 0, goMinutes: 0 }, at('10:44')).phase).toBe('work');
	});
});

describe('planLesson und bigRemaining', () => {
	it('Stunde ab jetzt', () => {
		expect(planLesson(new Date('2026-11-24T14:03:20'), 45)).toEqual({ startTime: '14:03:20', returnTime: '14:48:20' });
	});

	it('Restzeit groß', () => {
		expect(bigRemaining(40 * 60000)).toEqual({ value: '40', unit: 'min' });
		expect(bigRemaining(80 * 60000)).toEqual({ value: '1:20', unit: 'h' });
		expect(bigRemaining(-5000)).toEqual({ value: '0', unit: 'min' });
		expect(bigRemaining(null)).toEqual({ value: '0', unit: 'min' });
	});
});
