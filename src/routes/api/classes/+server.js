import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { createClass } from '#lib/server/classes.js';

// Neue Klasse: POST { name, color? } – wer sie anlegt, unterrichtet sie.
export async function POST({ locals, request }) {
	return json(createClass(requireTeacher(locals), await request.json()), { status: 201 });
}
