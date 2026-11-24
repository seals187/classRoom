import { json } from '@sveltejs/kit';
import { saveLesson, stopLesson } from '#lib/server/lesson.js';

// Stunde starten bzw. ändern: PUT { startTime, returnTime, roomName?, roomChange?, warnMinutes?, classId? }
export async function PUT({ locals, request }) {
	return json(saveLesson(locals, await request.json()));
}

// Stunde beenden.
export function DELETE({ locals }) {
	return json(stopLesson(locals));
}
