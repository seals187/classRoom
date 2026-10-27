import { redirect } from '@sveltejs/kit';

// Seit den Klassen: Verwaltung mit Reitern.
export function load() {
	redirect(308, '/verwaltung?tab=lehrer');
}
