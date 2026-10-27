import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { deleteClass, requireClass, updateClass } from '#lib/server/classes.js';

// Name, Farbe, archiviert: PATCH { name?, color?, archived? } – Lehrkräfte der Klasse und der Admin.
export async function PATCH({ locals, params, request }) {
	const klass = requireClass(requireTeacher(locals), Number(params.id));
	updateClass(klass.id, await request.json());
	return new Response(null, { status: 204 });
}

// Löschen – die Schüler bleiben.
export function DELETE({ locals, params }) {
	const klass = requireClass(requireTeacher(locals), Number(params.id));
	deleteClass(klass.id);
	return json({ ok: true });
}
