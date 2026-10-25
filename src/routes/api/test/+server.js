import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { clearTest, saveTest } from '#lib/server/db.js';

// Start/Ende kommen vom Browser der Lehrkraft, damit die Anzeige zu dessen Uhr passt.
export async function PUT({ locals, request }) {
	requireTeacher(locals);
	return json(saveTest(locals.owner, await request.json()));
}

export function DELETE({ locals }) {
	requireTeacher(locals);
	clearTest(locals.owner);
	return new Response(null, { status: 204 });
}
