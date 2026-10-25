import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { saveSchedule } from '#lib/server/db.js';

// Wochenplan im Menü (Stunden pro Wochentag mit Raum).
export async function PUT({ locals, request }) {
	requireTeacher(locals);
	const { schedule } = await request.json();
	return json(saveSchedule(locals.owner, schedule));
}
