// Seitenübergreifender UI-Zustand.
export const ui = $state({
	/** Fokus-Modus (z. B. beim Bearbeiten des Auftrags): Startseite ohne Stundenziel-Leiste. */
	focus: false,
	/** Auswahl-Fenster für den Hintergrund (aus dem Menü und von den Ziel-Seiten). */
	backgroundPicker: false
});
