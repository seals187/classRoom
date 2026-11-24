import { describe, expect, it } from 'vitest';
import { prepareContent } from './assignment-content.js';
import { cleanHtml } from './sanitize.js';

const texts = (/** @type {string} */ html) => prepareContent(html).steps.map((s) => s.text);

describe('prepareContent – was ist ein Schritt', () => {
	it('Punkte einer klassenlosen <ol> ganz oben', () => {
		expect(texts('<ol><li>Seite 10 lesen</li><li>Aufgabe 3</li></ol>')).toEqual(['Seite 10 lesen', 'Aufgabe 3']);
	});

	it('andere Listenarten und Unterlisten zählen nicht', () => {
		const html = '<ol class="letters"><li>a</li></ol><ul><li>b</li></ul><ol><li>Eins<ol><li>Unterpunkt</li></ol></li></ol>';
		expect(texts(html)).toEqual(['Eins']);
	});

	it('von Hand getippte Zeilen mit -, •, 1. und 1) in Absätzen', () => {
		const html = '<p>Einleitung</p><p>- Lesen</p><p>• Schreiben</p><p>3. Rechnen</p><p>4) Malen</p>';
		const { html: out, steps } = prepareContent(html);
		expect(steps.map((s) => s.text)).toEqual(['Lesen', 'Schreiben', 'Rechnen', 'Malen']);
		expect(out).toContain('<p>Einleitung</p><ol>');
	});

	it('Zeilen mit <br> in einem Absatz werden einzelne Schritte', () => {
		expect(texts('<p>- eins<br>- zwei<br>- drei</p>')).toEqual(['eins', 'zwei', 'drei']);
	});

	it('lose Zeilen ganz oben (ohne Absatz)', () => {
		expect(texts('- eins<br>- zwei')).toEqual(['eins', 'zwei']);
	});

	it('Absatz mit <br>, aber ohne Schritt-Zeile, bleibt unverändert', () => {
		const { html, steps } = prepareContent('<p>Hallo<br>Welt</p>');
		expect(steps).toEqual([]);
		expect(html).toBe('<p>Hallo<br>Welt</p>');
	});

	it('Leerzeilen zwischen Schritten fallen weg, ein Text dazwischen beginnt eine neue Liste', () => {
		const { html } = prepareContent('<p>- a</p><p></p><p>- b</p><p>Pause</p><p>- c</p>');
		expect(html.match(/<ol>/g)).toHaveLength(2);
		expect(texts('<p>- a</p><p></p><p>- b</p><p>Pause</p><p>- c</p>')).toEqual(['a', 'b', 'c']);
	});

	it('getippte Zeilen direkt nach einer echten Liste zählen dort weiter', () => {
		const { html, steps } = prepareContent('<ol><li>a</li></ol><p>- b</p>');
		expect(html.match(/<ol>/g)).toHaveLength(1);
		expect(steps.map((s) => s.text)).toEqual(['a', 'b']);
	});

	it('Kästen (Material, Tipp) sind keine Zeilen', () => {
		expect(texts('<div class="box tip">- kein Schritt</div>')).toEqual([]);
	});

	it('Strich ohne Leerzeichen ist kein Schritt', () => {
		expect(texts('<p>-5 Grad</p>')).toEqual([]);
	});

	it('Text: ohne Zusatzzeile nach <br>, ohne Badges und Unterlisten, Leerraum zusammengefasst', () => {
		const html = '<ol><li>Seite   10 <span class="badge time">10 min</span>lesen<br>leise<ul><li>x</li></ul></li></ol>';
		expect(texts(html)).toEqual(['Seite 10 lesen']);
	});

	it('Text höchstens 200 Zeichen', () => {
		expect(texts(`<ol><li>${'x'.repeat(250)}</li></ol>`)[0]).toHaveLength(200);
	});

	it('leerer Inhalt', () => {
		expect(prepareContent('')).toEqual({ html: '', steps: [] });
	});
});

describe('prepareContent – feste Schlüssel', () => {
	it('vergibt Schlüssel und schreibt sie als data-step ins HTML', () => {
		const { html, steps } = prepareContent('<ol><li>a</li><li>b</li></ol>');
		expect(steps).toHaveLength(2);
		for (const s of steps) expect(html).toContain(`data-step="${s.key}"`);
		expect(new Set(steps.map((s) => s.key)).size).toBe(2);
	});

	it('ist wiederholbar: zweimal aufbereitet ergibt dasselbe', () => {
		const once = prepareContent('<p>- a</p><p>- b</p>');
		expect(prepareContent(once.html)).toEqual(once);
	});

	it('Schlüssel bleibt, wenn der Text des Schritts geändert wird', () => {
		const first = prepareContent('<ol><li>Seite 10 lesen</li></ol>');
		const edited = first.html.replace('Seite 10 lesen', 'Seite 12 lesen');
		expect(prepareContent(edited).steps).toEqual([{ key: first.steps[0].key, text: 'Seite 12 lesen' }]);
	});

	it('Schlüssel bleibt, wenn davor ein neuer Schritt eingefügt wird', () => {
		const first = prepareContent('<ol><li>alt</li></ol>');
		const edited = first.html.replace('<ol>', '<ol><li>neu</li>');
		const { steps } = prepareContent(edited);
		expect(steps[1]).toEqual({ key: first.steps[0].key, text: 'alt' });
		expect(steps[0].key).not.toBe(first.steps[0].key);
	});

	it('doppelter Schlüssel (Enter im Editor kopiert das Attribut) – der zweite bekommt einen neuen', () => {
		const { steps } = prepareContent('<ol><li data-step="abc">eins</li><li data-step="abc">zwei</li></ol>');
		expect(steps[0].key).toBe('abc');
		expect(steps[1].key).not.toBe('abc');
	});

	it('eingerückter Schritt verliert seinen Schlüssel', () => {
		const { html } = prepareContent('<ol><li data-step="a1">eins<ol><li data-step="b2">zwei</li></ol></li></ol>');
		expect(html).toContain('data-step="a1"');
		expect(html).not.toContain('b2');
	});

	it('übersteht die Bereinigung (sanitize) – ungültige Schlüssel fliegen dort raus', () => {
		const { html, steps } = prepareContent(cleanHtml('<ol><li>a</li></ol>'));
		expect(cleanHtml(html)).toBe(html);
		expect(cleanHtml('<ol><li data-step="x&quot; onclick=&quot;y">a</li></ol>')).toBe('<ol><li>a</li></ol>');
		expect(steps).toHaveLength(1);
	});
});
