import { error } from '@sveltejs/kit';
import { deleteTeacher, renameTeacher, requireAdmin, requireTeacher, setTeacherPassword, setTeacherRights } from '#lib/server/auth.js';

// Eigenes Passwort darf jede Lehrkraft ändern; fremde Passwörter, Namen und Rechte nur der Admin.
export async function PATCH({ locals, params, request }) {
	const user = requireTeacher(locals);
	const id = Number(params.id);
	const { password, isAdmin, username } = await request.json();
	if (id !== user.id || isAdmin !== undefined || username !== undefined) requireAdmin(locals);
	if (password === undefined && isAdmin === undefined && username === undefined) error(400, 'Nichts zu ändern');
	if (password !== undefined) setTeacherPassword(id, { password });
	if (username !== undefined) renameTeacher(id, username);
	if (isAdmin !== undefined) setTeacherRights(id, { isAdmin }, user.id);
	return new Response(null, { status: 204 });
}

export function DELETE({ locals, params }) {
	const user = requireAdmin(locals);
	deleteTeacher(Number(params.id), user.id);
	return new Response(null, { status: 204 });
}
