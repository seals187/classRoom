import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, deleteSession, SESSION_COOKIE } from '#lib/server/auth.js';

export function POST({ cookies, request, url }) {
	const token = cookies.get(SESSION_COOKIE);
	if (token) deleteSession(token);
	clearSessionCookie(cookies, request, url);
	redirect(303, '/login');
}
