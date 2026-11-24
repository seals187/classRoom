import { json } from '@sveltejs/kit';
import { clearGoals, deleteGoals, sendGoals } from '#lib/server/goals.js';

// Dieselben Ziele für alle Schüler der aktiven Klasse, z. B.
// POST { kind: 'lesson', goals: [{ text: 'Seite 10 lesen', stepKey: 'k3f9' }, …] } (oder texts: ['…'])
// replace: vorher die Ziele dieser Art löschen · studentIds: nur diese Schüler (sonst alle der aktiven Klasse)
export async function POST({ locals, request }) {
	return json(sendGoals(locals, await request.json()));
}

// „Neue Stunde“: DELETE /api/goals?kind=lesson löscht alle eigenen Ziele einer Art.
// „Rückgängig“: DELETE mit { ids: [...] } löscht genau diese Ziele.
export async function DELETE({ locals, url, request }) {
	const body = await request.json().catch(() => null);
	if (body && Array.isArray(body.ids)) return json(deleteGoals(locals, body.ids));
	return json(clearGoals(locals, url.searchParams.get('kind') ?? undefined));
}
