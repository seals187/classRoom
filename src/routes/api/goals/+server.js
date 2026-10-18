import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { addGoalsToAll, clearGoals } from '#lib/server/db.js';

// Dieselben Ziele für alle Schüler, z. B. POST { kind: 'lesson', texts: ['Seite 10 lesen', …], replace: true }
// replace: vorher alle Ziele dieser Art löschen („Bisherige Stundenziele ersetzen“).
export async function POST({ locals, request }) {
	requireTeacher(locals);
	const { texts, kind, replace } = await request.json();
	return json(addGoalsToAll(texts, kind, replace === true));
}

// „Neue Stunde“: alle Ziele einer Art löschen, z. B. DELETE /api/goals?kind=lesson
export function DELETE({ locals, url }) {
	requireTeacher(locals);
	return json(clearGoals(url.searchParams.get('kind') ?? undefined));
}
