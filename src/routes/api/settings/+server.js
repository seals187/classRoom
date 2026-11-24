import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { getSettings } from '#lib/server/db.js';
import { chooseView, saveLesson, stopLesson } from '#lib/server/lesson.js';

// Für ältere Clients und Skripte – die App nutzt /api/lesson (Stunde) und /api/class (Klasse).
// PUT { classId?, selfAll?, startTime?, returnTime?, … }: leere Zeiten beenden die Stunde.
export async function PUT({ locals, request }) {
	requireTeacher(locals);
	const { classId, selfAll, ...input } = await request.json();
	if (selfAll === true) chooseView(locals, { all: true });
	else if (classId !== undefined) chooseView(locals, { classId });
	if (Object.keys(input).length === 0) return json(getSettings(locals.owner));
	if (!input.startTime && !input.returnTime) return json(stopLesson(locals));
	return json(saveLesson(locals, input));
}

export function DELETE({ locals }) {
	return json(stopLesson(locals));
}
