import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { addStudent } from '#lib/server/db.js';

// Neue Schüler gehören der Lehrkraft, die sie anlegt.
export async function POST({ locals, request }) {
	requireTeacher(locals);
	return json(addStudent(locals.owner, await request.json()), { status: 201 });
}
