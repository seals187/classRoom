import { json } from '@sveltejs/kit';
import { copyAssignment } from '#lib/server/assignment.js';
import { requireTeacher } from '#lib/server/auth.js';

// Kopie als neuer Entwurf.
export function POST({ locals, params }) {
	requireTeacher(locals);
	return json(copyAssignment(locals.owner, Number(params.id)));
}
