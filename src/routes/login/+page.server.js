import { fail, redirect } from '@sveltejs/kit';
import { login, setSessionCookie } from '#lib/server/auth.js';
import pkg from '../../../package.json';

// Erstes Jahr für „© 2026–…“; das aktuelle Jahr kommt aus der Serverzeit.
const FIRST_YEAR = 2026;

export function load() {
	const year = new Date().getFullYear();
	return {
		version: pkg.version,
		years: year > FIRST_YEAR ? `${FIRST_YEAR}–${year}` : String(FIRST_YEAR)
	};
}

export const actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!username || !password) return fail(400, { username, message: 'Bitte Benutzername und Passwort eingeben.' });

		const result = login(username, password);
		if (!result.ok) return fail(result.status, { username, message: result.message });

		setSessionCookie(cookies, request, url, result.token, result.expires);
		redirect(303, '/');
	}
};
