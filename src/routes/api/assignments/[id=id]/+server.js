import { json } from '@sveltejs/kit';
import { deleteAssignment, updateAssignment } from '#lib/server/assignment.js';

// Nur die mitgeschickten Teile ändern: Inhalt, classIds, date, archived (Rechte prüft assignment.js).
export async function PUT({ locals, params, request }) {
	return json(updateAssignment(locals, Number(params.id), await request.json()));
}

export function DELETE({ locals, params }) {
	deleteAssignment(locals, Number(params.id));
	return new Response(null, { status: 204 });
}
