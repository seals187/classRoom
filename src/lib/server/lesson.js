import { error } from '@sveltejs/kit';
import { requireTeacher } from './auth.js';
import { chooseClass } from './classes.js';
import { getSettings, saveSettings, writeSettings } from './db.js';

// Stunde einer Lehrkraft: starten bzw. ändern, beenden und welche Klasse gilt. Beginn und Ende stehen bei den
// Einstellungen der Lehrkraft; ob und in welcher Phase die Stunde läuft, berechnet #lib/lesson.js.

/** @typedef {Pick<App.Locals, 'user' | 'owner'>} Actor */

/**
 * Stunde speichern – neu (Beginn = jetzt im Browser) oder eine laufende ändern (Ende, Raum, Aufräumen).
 * Ein neuer Beginn merkt sich den Zeitpunkt: Schüler mit mehreren Lehrkräften sehen die, die zuletzt eine Stunde
 * gestartet hat (siehe resolveOwner in auth.js).
 * @param {Actor} actor
 * @param {Record<string, unknown>} input startTime, returnTime, roomName?, roomChange?, warnMinutes?, classId?
 */
export function saveLesson(actor, input) {
	const user = requireTeacher(actor);
	if (!input.startTime || !input.returnTime) error(400, 'Beginn und Ende fehlen');
	if (input.classId !== undefined) chooseClass(user, input.classId);
	const before = getSettings(actor.owner).startTime;
	const { classId, ...rest } = input;
	const saved = saveSettings(actor.owner, rest);
	if (saved.startTime !== before) writeSettings(actor.owner, { lessonStartedAt: String(Date.now()) });
	return saved;
}

/** Laufende Stunde beenden (gilt auch gegen Standardzeiten aus der .env). @param {Actor} actor */
export function stopLesson(actor) {
	requireTeacher(actor);
	writeSettings(actor.owner, { startTime: '', returnTime: '' });
	return getSettings(actor.owner);
}

/**
 * Welche Klasse gilt (Stundenziele, Selbstlernen, „Ziele an alle“): { classId } – oder fürs Selbstlernen
 * { all: true } = alle eigenen Klassen.
 * @param {Actor} actor
 * @param {{ classId?: unknown, all?: unknown }} input
 */
export function chooseView(actor, input) {
	const user = requireTeacher(actor);
	if (input.all === true) {
		writeSettings(actor.owner, { selfAll: '1' });
		return;
	}
	chooseClass(user, input.classId);
	writeSettings(actor.owner, { selfAll: '0' });
}
