import { publicAssignment } from '#lib/server/share.js';

// Öffentlich (siehe hooks.server.js): nur Titel, Text, Bilder und Links des geteilten Auftrags.
export function load({ params, getClientAddress }) {
	return { code: params.code, ...publicAssignment(params.code, getClientAddress()) };
}
