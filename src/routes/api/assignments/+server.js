import { json } from '@sveltejs/kit';
import { createAssignment } from '#lib/server/assignment.js';

// Neuer Auftrag (Entwurf): { title, html, images, classIds?, date? }
export async function POST({ locals, request }) {
	return json(createAssignment(locals, await request.json()));
}
