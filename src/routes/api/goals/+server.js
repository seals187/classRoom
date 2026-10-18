import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { clearGoals } from '#lib/server/db.js';

// „Neue Stunde“: alle Ziele einer Art löschen, z. B. DELETE /api/goals?kind=lesson
export function DELETE({ locals, url }) {
	requireTeacher(locals);
	return json(clearGoals(url.searchParams.get('kind') ?? undefined));
}
