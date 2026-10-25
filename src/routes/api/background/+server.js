import { json } from '@sveltejs/kit';
import { getBackground, listBackgroundImages, saveBackground } from '#lib/server/backgrounds.js';

// Angemeldet sind hier alle (hooks.server.js); was jemand ändern darf, prüft saveBackground.
export function GET({ locals }) {
	const user = /** @type {import('#lib/server/auth.js').User} */ (locals.user);
	return json({ ...getBackground(user, locals.owner), images: listBackgroundImages(user, locals.owner) });
}

export async function PUT({ locals, request }) {
	const user = /** @type {import('#lib/server/auth.js').User} */ (locals.user);
	return json(saveBackground(user, locals.owner, await request.json()));
}
