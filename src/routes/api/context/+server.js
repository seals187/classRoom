import { error, json } from '@sveltejs/kit';
import { TEACHER_COOKIE, teachersOf } from '#lib/server/auth.js';

// Schüler mit mehreren Lehrkräften: im Menü wählen, wessen Auftrag, Stunde und Ziele sie sehen.
// teacherId 0 = wieder automatisch (wer zuletzt eine Stunde gestartet hat).
// Das Cookie enthält nur die Wahl (kein Geheimnis) und gilt daher auch ohne HTTPS.
export async function PUT({ locals, cookies, request }) {
	const user = locals.user;
	if (user?.role !== 'student') error(403, 'Nur für Schüler');
	const teacherId = Number((await request.json()).teacherId) || 0;
	if (teacherId && !teachersOf(/** @type {number} */ (user.studentId)).some((t) => t.id === teacherId)) {
		error(404, 'Lehrkraft nicht gefunden');
	}
	if (teacherId) cookies.set(TEACHER_COOKIE, String(teacherId), { path: '/', httpOnly: true, sameSite: 'lax', secure: false });
	else cookies.delete(TEACHER_COOKIE, { path: '/', secure: false });
	return json({ teacherId });
}
