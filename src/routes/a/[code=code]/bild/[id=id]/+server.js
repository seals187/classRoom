import { publicImage } from '#lib/server/share.js';

// Bild eines geteilten Auftrags – nur mit gültigem Code. Nicht zwischenspeichern: nach „Teilen beenden“ ist es weg.
export function GET({ params, getClientAddress }) {
	const file = publicImage(params.code, Number(params.id), getClientAddress());
	return new Response(new Uint8Array(file.data), {
		headers: { 'content-type': file.mime, 'x-content-type-options': 'nosniff' }
	});
}
