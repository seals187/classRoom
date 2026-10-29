import { json } from '@sveltejs/kit';
import { transferAssignment } from '#lib/server/assignment.js';
import { requireTeacher } from '#lib/server/auth.js';

// Einen eigenen Auftrag an eine andere Lehrkraft kopieren oder übertragen.
// POST { id, to, mode: 'copy' | 'move' }
export async function POST({ locals, request }) {
	requireTeacher(locals);
	const { id, to, mode } = await request.json();
	transferAssignment(locals.owner, Number(id), Number(to), mode);
	return new Response(null, { status: 204 });
}
