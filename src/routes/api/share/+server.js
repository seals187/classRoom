import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { endShare, listShares, setShare, shareTarget } from '#lib/server/share.js';

// Geteilte Aufträge: die eigenen bzw. für den Admin alle.
export function GET({ locals }) {
	return json(listShares(requireTeacher(locals)));
}

// Teilen starten oder ändern: PUT { assignment?, teacher?, days?, renew?: true } – ohne `assignment` der aktive.
export async function PUT({ locals, request }) {
	const user = requireTeacher(locals);
	const { assignment, teacher, days, renew } = await request.json();
	return json(setShare(shareTarget(user, { assignment, teacher }), { days, renew }));
}

// Teilen beenden: DELETE { assignment?, teacher? }
export async function DELETE({ locals, request }) {
	const user = requireTeacher(locals);
	const body = await request.json().catch(() => ({}));
	endShare(shareTarget(user, { assignment: body?.assignment, teacher: body?.teacher }));
	return new Response(null, { status: 204 });
}
