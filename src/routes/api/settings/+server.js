import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { chooseClass } from '#lib/server/classes.js';
import { resetSettings, saveSettings } from '#lib/server/db.js';

// Stunde (Zeiten, Raum, Aufräumen) speichern; `classId` wählt die Klasse für die Stunde.
export async function PUT({ locals, request }) {
	const user = requireTeacher(locals);
	const { classId, ...input } = await request.json();
	if (classId !== undefined) chooseClass(user, classId);
	return json(saveSettings(locals.owner, input));
}

// Gespeicherte Werte verwerfen → wieder die Standardwerte aus der .env.
export function DELETE({ locals }) {
	requireTeacher(locals);
	return json(resetSettings(locals.owner));
}
