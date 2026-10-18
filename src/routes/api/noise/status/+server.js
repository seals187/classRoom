import { error, json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { getLiveNoise, setLiveNoise } from '#lib/server/noise-status.js';

export function GET() {
	return json(getLiveNoise());
}

export async function POST({ locals, request }) {
	requireTeacher(locals);
	try {
		setLiveNoise(await request.json());
	} catch (err) {
		error(400, err instanceof Error ? err.message : 'Ungültige Anfrage');
	}
	return json(getLiveNoise());
}
