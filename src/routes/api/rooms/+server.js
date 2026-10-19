import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { saveRooms } from '#lib/server/db.js';

// Räume zur Auswahl im Menü (Raum hinzufügen / entfernen).
export async function PUT({ locals, request }) {
	requireTeacher(locals);
	const { rooms } = await request.json();
	return json(saveRooms(rooms));
}
