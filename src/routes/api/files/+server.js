import { json } from '@sveltejs/kit';
import { saveImage } from '$lib/server/assignment.js';
import { requireTeacher } from '$lib/server/auth.js';

export async function POST({ locals, request }) {
	requireTeacher(locals);
	const form = await request.formData();
	return json(await saveImage(form.get('file')), { status: 201 });
}
