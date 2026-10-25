import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { resetSettings, saveSettings } from '#lib/server/db.js';

export async function PUT({ locals, request }) {
	requireTeacher(locals);
	return json(saveSettings(locals.owner, await request.json()));
}

// Gespeicherte Werte verwerfen → wieder die Standardwerte aus der .env.
export function DELETE({ locals }) {
	requireTeacher(locals);
	return json(resetSettings(locals.owner));
}
