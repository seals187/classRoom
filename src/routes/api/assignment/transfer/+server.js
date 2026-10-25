import { error, json } from '@sveltejs/kit';
import { transferAssignment } from '#lib/server/assignment.js';
import { requireTeacher } from '#lib/server/auth.js';

// Auftrag an eine andere Lehrkraft kopieren oder übertragen: den eigenen jede Lehrkraft, fremde nur der Admin.
// POST { from, to, mode: 'copy' | 'move', replace?: true }
export async function POST({ locals, request }) {
	const user = requireTeacher(locals);
	const { from, to, mode, replace } = await request.json();
	const source = Number(from) || user.id;
	if (source !== user.id && !user.isAdmin) error(403, 'Nur den eigenen Auftrag weitergeben');
	return json(transferAssignment(source, Number(to), mode, replace === true));
}
