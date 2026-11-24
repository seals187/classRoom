import { transferAssignment } from '#lib/server/assignment.js';

// Auftrag an eine andere Lehrkraft kopieren oder übertragen: { id, to, mode: 'copy' | 'move' }
export async function POST({ locals, request }) {
	const { id, to, mode } = await request.json();
	transferAssignment(locals, Number(id), Number(to), mode);
	return new Response(null, { status: 204 });
}
