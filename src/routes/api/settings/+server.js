import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { chooseClass } from '#lib/server/classes.js';
import { getSettings, resetSettings, saveSettings, writeSettings } from '#lib/server/db.js';

// Stunde (Zeiten, Raum, Aufräumen) speichern; `classId` wählt die aktive Klasse (auch ohne Stunde),
// `selfAll` zeigt im Selbstlernen alle eigenen Klassen. Nur `classId`/`selfAll` → die Stunde bleibt unverändert.
export async function PUT({ locals, request }) {
	const user = requireTeacher(locals);
	const { classId, selfAll, ...input } = await request.json();
	if (classId !== undefined) chooseClass(user, classId);
	if (selfAll !== undefined) writeSettings(locals.owner, { selfAll: selfAll === true ? '1' : '0' });
	if (Object.keys(input).length === 0) return json(getSettings(locals.owner));
	return json(saveSettings(locals.owner, input));
}

// Gespeicherte Werte verwerfen → wieder die Standardwerte aus der .env.
export function DELETE({ locals }) {
	requireTeacher(locals);
	return json(resetSettings(locals.owner));
}
