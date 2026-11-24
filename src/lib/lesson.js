import { formatClock, lessonEnded, lessonSpan } from './time.js';

// Zustand der Stunde: die einzige Stelle, die aus Beginn/Ende und der Uhrzeit ableitet, ob eine Stunde läuft und in
// welcher Phase sie ist. Kopfband, Menü, Zielkacheln und die geteilte Seite lesen nur das Ergebnis.

/**
 * none:   keine Stunde (nichts gesetzt oder seit 15 min vorbei, siehe OVERTIME_MS)
 * before: Beginn liegt noch in der Zukunft
 * work → soon (Aufräumen, WARN_MINUTES) → go (Losgehen, GO_MINUTES) → over (Zeit um, bis 15 min danach)
 * @typedef {'none' | 'before' | 'work' | 'soon' | 'go' | 'over'} LessonPhase
 */

/**
 * @typedef {{
 *   phase: LessonPhase,
 *   running: boolean,
 *   start: Date | null,
 *   end: Date | null,
 *   remaining: number | null,
 *   progress: number,
 *   overMinutes: number
 * }} LessonState
 * running: Stunde läuft (work, soon, go oder over) · remaining: ms bis zum Ende (negativ = überzogen) ·
 * progress: 0…1 von Beginn bis Ende · overMinutes: ganze Minuten überzogen
 */

/**
 * @param {{ startTime: string, returnTime: string }} times gespeicherte Zeiten „HH:MM(:SS)“ oder leer
 * @param {{ warnMinutes: number, goMinutes: number }} limits
 * @param {Date} now
 * @returns {LessonState}
 */
export function lessonState({ startTime, returnTime }, { warnMinutes, goMinutes }, now) {
	const { start, end } = lessonSpan(startTime, returnTime, now);
	const none = { phase: /** @type {LessonPhase} */ ('none'), running: false, start, end, remaining: null, progress: 0, overMinutes: 0 };
	if (!returnTime || !end || lessonEnded({ end }, now)) return none;
	const remaining = end.getTime() - now.getTime();
	if (start && now < start) return { ...none, phase: 'before', remaining };
	const total = start ? end.getTime() - start.getTime() : 0;
	const progress = remaining <= 0 ? 1 : total > 0 && start ? Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / total)) : 0;
	/** @type {LessonPhase} */
	const phase = remaining <= 0 ? 'over' : remaining <= goMinutes * 60000 ? 'go' : remaining <= warnMinutes * 60000 ? 'soon' : 'work';
	return { phase, running: true, start, end, remaining, progress, overMinutes: remaining < 0 ? Math.floor(-remaining / 60000) : 0 };
}

/**
 * Zeiten für „Stunde starten“: Beginn jetzt, Ende nach so vielen Minuten (Stunde läuft ab dem Klick).
 * @param {Date} now
 * @param {number} minutes
 */
export function planLesson(now, minutes) {
	return { startTime: formatClock(now), returnTime: formatClock(new Date(now.getTime() + minutes * 60000)) };
}

/**
 * Restzeit groß: „40 min“ bzw. „1:20 h“.
 * @param {number | null} remaining ms
 */
export function bigRemaining(remaining) {
	const m = remaining !== null ? Math.max(0, Math.ceil(remaining / 60000)) : 0;
	return m < 60 ? { value: String(m), unit: 'min' } : { value: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, unit: 'h' };
}
