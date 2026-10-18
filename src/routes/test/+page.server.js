import { getTest } from '#lib/server/db.js';

export function load() {
	return { test: getTest() };
}
