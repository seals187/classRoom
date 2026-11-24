import { json } from '@sveltejs/kit';
import { chooseView } from '#lib/server/lesson.js';

// Welche Klasse gilt: PUT { classId } – oder fürs Selbstlernen alle eigenen Klassen: PUT { all: true }
export async function PUT({ locals, request }) {
	chooseView(locals, await request.json());
	return json({ ok: true });
}
