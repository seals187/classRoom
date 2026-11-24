import { json } from '@sveltejs/kit';
import { deleteStudent, updateStudent } from '#lib/server/db.js';

// Ändern bzw. löschen – Rechte (sichtbarer Schüler, Test-Schüler nur Admin) prüft db.js.
export async function PATCH({ locals, params, request }) {
	return json(updateStudent(locals, Number(params.id), await request.json()));
}

export function DELETE({ locals, params }) {
	return json(deleteStudent(locals, Number(params.id)));
}
