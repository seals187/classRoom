import { json } from '@sveltejs/kit';
import { showAssignment } from '#lib/server/assignment.js';
import { requireTeacher } from '#lib/server/auth.js';

// „Zeigen“: diesen Auftrag aktiv machen (Beamer und Schüler sehen ihn).
export function POST({ locals, params }) {
	requireTeacher(locals);
	return json(showAssignment(locals.owner, Number(params.id)));
}
