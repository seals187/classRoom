import { deleteTeacher, requireAdmin, updateTeacher } from '#lib/server/auth.js';

// Passwort, Name, Admin-Recht ändern: { password?, username?, isAdmin? } – Rechte prüft auth.js.
export async function PATCH({ locals, params, request }) {
	updateTeacher(locals, Number(params.id), await request.json());
	return new Response(null, { status: 204 });
}

export function DELETE({ locals, params }) {
	const user = requireAdmin(locals);
	deleteTeacher(Number(params.id), user.id);
	return new Response(null, { status: 204 });
}
