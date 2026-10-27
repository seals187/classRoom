import { error, json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { endShare, listShares, setShare } from '#lib/server/share.js';

/**
 * Wessen Auftrag: der eigene, fremde nur als Admin.
 * @param {import('#lib/server/auth.js').User} user
 * @param {unknown} teacher
 */
function targetOf(user, teacher) {
	const id = Number(teacher) || user.id;
	if (id !== user.id && !user.isAdmin) error(403, 'Nur den eigenen Auftrag');
	return id;
}

// Geteilte Aufträge: die eigenen bzw. für den Admin alle.
export function GET({ locals }) {
	return json(listShares(requireTeacher(locals)));
}

// Teilen starten oder ändern: PUT { teacher?, days?, renew?: true }
export async function PUT({ locals, request }) {
	const user = requireTeacher(locals);
	const { teacher, days, renew } = await request.json();
	return json(setShare(targetOf(user, teacher), { days, renew }));
}

// Teilen beenden: DELETE { teacher? }
export async function DELETE({ locals, request }) {
	const user = requireTeacher(locals);
	const body = await request.json().catch(() => ({}));
	endShare(targetOf(user, body?.teacher));
	return new Response(null, { status: 204 });
}
