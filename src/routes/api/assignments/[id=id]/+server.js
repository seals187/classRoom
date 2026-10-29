import { json } from '@sveltejs/kit';
import { deleteAssignment, updateAssignment } from '#lib/server/assignment.js';
import { requireTeacher } from '#lib/server/auth.js';

// Auftrag ändern – nur die mitgeschickten Teile: PUT { title, html, images } | { classIds } | { date } | { archived }
export async function PUT({ locals, params, request }) {
	const user = requireTeacher(locals);
	return json(updateAssignment(locals.owner, user, Number(params.id), await request.json()));
}

export function DELETE({ locals, params }) {
	requireTeacher(locals);
	deleteAssignment(locals.owner, Number(params.id));
	return new Response(null, { status: 204 });
}
