import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, deleteSession, SESSION_COOKIE, TEACHER_COOKIE } from '#lib/server/auth.js';

export function POST({ cookies, request, url }) {
	const token = cookies.get(SESSION_COOKIE);
	if (token) deleteSession(token);
	clearSessionCookie(cookies, request, url);
	cookies.delete(TEACHER_COOKIE, { path: '/', secure: false });
	redirect(303, '/login');
}
