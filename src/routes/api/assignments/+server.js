import { json } from '@sveltejs/kit';
import { createAssignment } from '#lib/server/assignment.js';
import { requireTeacher } from '#lib/server/auth.js';

// Neuer Auftrag: POST { title, html, images, classIds?, date? }
export async function POST({ locals, request }) {
	const user = requireTeacher(locals);
	return json(createAssignment(locals.owner, user, await request.json()));
}
