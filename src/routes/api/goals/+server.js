import { json } from '@sveltejs/kit';
import { classScope, requireTeacher } from '#lib/server/auth.js';
import { addGoalsToAll, clearGoals, deleteGoals } from '#lib/server/db.js';

// Dieselben Ziele für mehrere Schüler, z. B. POST { kind: 'lesson', texts: ['Seite 10 lesen', …] }
// replace: vorher die Ziele dieser Art löschen · studentIds: nur diese Schüler (sonst alle der aktiven Klasse)
export async function POST({ locals, request }) {
	requireTeacher(locals);
	const { texts, kind, replace, studentIds } = await request.json();
	return json(addGoalsToAll(classScope(locals), texts, kind, replace === true, Array.isArray(studentIds) ? studentIds : null));
}

// „Neue Stunde“: DELETE /api/goals?kind=lesson löscht alle eigenen Ziele einer Art.
// „Rückgängig“: DELETE mit { ids: [...] } löscht genau diese Ziele.
export async function DELETE({ locals, url, request }) {
	requireTeacher(locals);
	const body = await request.json().catch(() => null);
	if (body && Array.isArray(body.ids)) return json(deleteGoals(locals.owner, body.ids));
	return json(clearGoals(locals.owner, url.searchParams.get('kind') ?? undefined));
}
