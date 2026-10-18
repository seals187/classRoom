import { getFile } from '$lib/server/assignment.js';

// Nur für angemeldete Benutzer (siehe hooks.server.js). Dateien ändern sich nie → lange cachen.
export function GET({ params }) {
	const file = getFile(Number(params.id));
	return new Response(new Uint8Array(file.data), {
		headers: {
			'content-type': file.mime,
			'cache-control': 'private, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		}
	});
}
