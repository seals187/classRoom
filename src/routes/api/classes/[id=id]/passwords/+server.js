import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { requireClass, resetClassPasswords } from '#lib/server/classes.js';

// Neue Passwörter für die ganze Klasse – die Antwort ist das Einzige, wo sie im Klartext stehen (zum Drucken).
export function POST({ locals, params }) {
	const klass = requireClass(requireTeacher(locals), Number(params.id));
	return json(resetClassPasswords(klass.id));
}
