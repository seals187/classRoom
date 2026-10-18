import { defineParams } from '@sveltejs/kit/params';

// Parameter-Matcher für Routen wie /api/students/[id=id] (seit SvelteKit 3 in einer Datei).
// Ein Matcher gibt den umgewandelten Wert zurück – oder undefined, wenn die Route nicht passt.
export const params = defineParams({
	/** Nur positive Ganzzahlen. @param {string} param */
	id: (param) => (/^\d+$/.test(param) ? Number(param) : undefined)
});
