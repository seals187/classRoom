import { json } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/auth.js';
import { requireClass, setClassTeacher } from '#lib/server/classes.js';

// Lehrkraft zuweisen/entfernen (nur Admin): PUT { teacherId, on }
export async function PUT({ locals, params, request }) {
	const klass = requireClass(requireAdmin(locals), Number(params.id));
	const { teacherId, on } = await request.json();
	setClassTeacher(klass.id, teacherId, on === true);
	return json({ ok: true });
}
