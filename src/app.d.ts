declare global {
	namespace App {
		interface Locals {
			user: import('#lib/server/auth.js').User | null;
			/** Lehrkraft, deren Klasse gilt (0 = keine) */
			owner: number;
		}
	}
}

export {};
