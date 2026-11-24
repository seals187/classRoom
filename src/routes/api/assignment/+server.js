import { json } from '@sveltejs/kit';
import { deleteActiveAssignment, getActiveAssignment, saveActiveAssignment } from '#lib/server/assignment.js';

// Ältere Clients und Skripte: den aktiven Auftrag ändern bzw. löschen (Rechte prüft assignment.js).
export async function PUT({ locals, request }) {
	return json(saveActiveAssignment(locals, await request.json()));
}

export function DELETE({ locals }) {
	deleteActiveAssignment(locals);
	return json(getActiveAssignment(locals.owner));
}
