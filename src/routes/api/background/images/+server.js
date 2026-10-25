import { json } from '@sveltejs/kit';
import { addBackgroundImage } from '#lib/server/backgrounds.js';

export async function POST({ locals, request }) {
	const user = /** @type {import('#lib/server/auth.js').User} */ (locals.user);
	const form = await request.formData();
	return json(await addBackgroundImage(user, locals.owner, form.get('file')), { status: 201 });
}
