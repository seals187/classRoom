declare global {
	namespace App {
		interface Locals {
			user: import('$lib/server/auth.js').User | null;
		}
	}
}

export {};
