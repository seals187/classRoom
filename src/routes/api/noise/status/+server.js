import { error, json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { getLiveNoise, setLiveNoise } from '#lib/server/noise-status.js';

// Schüler sehen die Ampel der Lehrkraft, deren Klasse gerade gilt.
export function GET({ locals }) {
	return json(getLiveNoise(locals.owner));
}

export async function POST({ locals, request }) {
	requireTeacher(locals);
	try {
		setLiveNoise(locals.owner, await request.json());
	} catch (err) {
		error(400, err instanceof Error ? err.message : 'Ungültige Anfrage');
	}
	return json(getLiveNoise(locals.owner));
}
