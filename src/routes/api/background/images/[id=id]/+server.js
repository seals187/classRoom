import { deleteBackgroundImage } from '#lib/server/backgrounds.js';

export function DELETE({ locals, params }) {
	const user = /** @type {import('#lib/server/auth.js').User} */ (locals.user);
	deleteBackgroundImage(user, locals.owner, Number(params.id));
	return new Response(null, { status: 204 });
}
