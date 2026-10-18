import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { saveNoiseSettings } from '#lib/server/db.js';

export async function PUT({ locals, request }) {
	requireTeacher(locals);
	return json(saveNoiseSettings(await request.json()));
}
