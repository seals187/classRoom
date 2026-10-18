import { json } from '@sveltejs/kit';
import { clearSessionCookie, ensureEnvTeacher, SESSION_COOKIE, validateSession } from '$lib/server/auth.js';
import { getConfig } from '$lib/server/config.js';

export function init() {
	ensureEnvTeacher();
}

const PUBLIC_PATHS = ['/login'];
// Seiten, die Schüler sehen dürfen. Die API prüft ihre Rechte in jeder Route selbst.
const STUDENT_PATHS = ['/', '/stundenziele', '/selbstlernen', '/logout'];

/** @param {string} location */
const redirectTo = (location) => new Response(null, { status: 303, headers: { location } });

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Schreibende Anfragen nur von derselben Seite (Schutz gegen CSRF).
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
function isSameOrigin(event) {
	const origin = event.request.headers.get('origin');
	if (!origin) return false;
	try {
		return new URL(origin).host === event.url.host;
	} catch {
		return false;
	}
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve: resolvePage }) {
	// Standard-Theme aus der .env in app.html einsetzen.
	const theme = getConfig().defaultTheme;
	/** @param {import('@sveltejs/kit').RequestEvent} e */
	const resolve = (e) => resolvePage(e, { transformPageChunk: ({ html }) => html.replace('%classroom.theme%', theme) });

	if (!SAFE_METHODS.includes(event.request.method) && !isSameOrigin(event)) {
		return json({ message: 'Anfrage von fremder Seite abgelehnt' }, { status: 403 });
	}

	const token = event.cookies.get(SESSION_COOKIE);
	const user = token ? validateSession(token) : null;
	if (token && !user) clearSessionCookie(event.cookies, event.request, event.url);
	event.locals.user = user;

	const path = event.url.pathname;
	const isApi = path.startsWith('/api/');

	if (!user) {
		if (PUBLIC_PATHS.includes(path)) return resolve(event);
		return isApi ? json({ message: 'Nicht angemeldet' }, { status: 401 }) : redirectTo('/login');
	}
	if (PUBLIC_PATHS.includes(path)) return redirectTo('/');
	if (user.role === 'student' && !isApi && !STUDENT_PATHS.includes(path)) return redirectTo('/');

	return resolve(event);
}
