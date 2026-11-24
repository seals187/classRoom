import { api } from './api.js';
import { planLesson } from './lesson.js';

// Stunde starten, ändern und beenden (Kopfband und Menü). Gespeichert wird über /api/lesson, siehe
// #lib/server/lesson.js; die Uhrzeiten kommen aus dem Browser (dessen Zeitzone gilt).

/**
 * @typedef {{
 *   startTime: string, returnTime: string, roomName?: string, roomChange?: boolean,
 *   warnMinutes?: number, classId?: number
 * }} LessonInput
 */

/** Stunde mit diesen Zeiten speichern (neu oder laufende ändern). @param {LessonInput} input */
export const saveLesson = (input) => api('/api/lesson', 'PUT', input);

/** Laufende Stunde beenden. */
export const stopLesson = () => api('/api/lesson', 'DELETE');

/**
 * Stunde ab jetzt für so viele Minuten.
 * @param {number} minutes
 * @param {Omit<LessonInput, 'startTime' | 'returnTime'>} [extra] Raum, Aufräumen, Klasse
 */
export const startLessonNow = (minutes, extra = {}) => saveLesson({ ...planLesson(new Date(), minutes), ...extra });
