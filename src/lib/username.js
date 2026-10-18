// Benutzernamen-Vorschlag für Schüler – gemeinsam für das Formular (Vorbelegung) und den Server.

/** "Jörg" → "joerg": klein, Umlaute umschreiben, nur a–z und 0–9. @param {string} s */
const clean = (s) =>
	s
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]/g, '');

/**
 * 3 Buchstaben Vorname + 2 Buchstaben Nachname, z. B. "Anna Muster" → "annmu".
 * Ist der Name vergeben (oder zu kurz), wird eine Zahl angehängt: "annmu2", "annmu3" …
 * @param {string} firstName
 * @param {string} lastName
 * @param {(name: string) => boolean} isTaken
 */
export function suggestUsername(firstName, lastName, isTaken) {
	const base = clean(firstName).slice(0, 3) + clean(lastName).slice(0, 2) || 'schueler';
	let name = base;
	for (let n = 2; name.length < 3 || isTaken(name); n++) name = `${base}${n}`;
	return name;
}
