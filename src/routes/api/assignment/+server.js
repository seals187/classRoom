import { json } from '@sveltejs/kit';
import { deleteActiveAssignment, getActiveAssignment, saveActiveAssignment } from '#lib/server/assignment.js';
import { requireTeacher } from '#lib/server/auth.js';

// Der aktive Auftrag (ältere Clients und Skripte). Mehrere Aufträge: /api/assignments.
export async function PUT({ locals, request }) {
	const user = requireTeacher(locals);
	return json(saveActiveAssignment(locals.owner, user, await request.json()));
}

export function DELETE({ locals }) {
	requireTeacher(locals);
	deleteActiveAssignment(locals.owner);
	return json(getActiveAssignment(locals.owner));
}
