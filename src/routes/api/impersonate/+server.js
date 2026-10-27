import { error, json } from '@sveltejs/kit';
import {
	impersonate,
	requireAdmin,
	returnToAdmin,
	SESSION_COOKIE,
	setSessionCookie,
	TEACHER_COOKIE
} from '#lib/server/auth.js';

/**
 * Neue Sitzung setzen; die Lehrkraft-Wahl (Schüler mit mehreren Lehrkräften) gilt nicht weiter.
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @param {{ token: string, expires: Date }} session
 */
function switchTo({ cookies, request, url }, session) {
	setSessionCookie(cookies, request, url, session.token, session.expires);
	cookies.delete(TEACHER_COOKIE, { path: '/', secure: false });
	return json({ ok: true });
}

// „Anmelden als …“ (nur Admin): POST { teacherId } oder { studentId }
export async function POST(event) {
	const admin = requireAdmin(event.locals);
	const token = event.cookies.get(SESSION_COOKIE) ?? '';
	return switchTo(event, impersonate(token, admin, await event.request.json()));
}

// Zurück zum eigenen Admin-Konto
export function DELETE(event) {
	const user = event.locals.user;
	if (!user) error(401, 'Nicht angemeldet');
	return switchTo(event, returnToAdmin(event.cookies.get(SESSION_COOKIE) ?? '', user));
}
