import { getTest } from '#lib/server/db.js';

export function load({ locals }) {
	return { test: getTest(locals.owner) };
}
