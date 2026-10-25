import { json } from '@sveltejs/kit';
import { deleteAssignment, saveAssignment } from '#lib/server/assignment.js';
import { requireTeacher } from '#lib/server/auth.js';

export async function PUT({ locals, request }) {
	requireTeacher(locals);
	return json(saveAssignment(locals.owner, await request.json()));
}

export function DELETE({ locals }) {
	requireTeacher(locals);
	return json(deleteAssignment(locals.owner));
}
