import { parseHTML } from 'linkedom';

// Inhalt eines Auftrags: Was ist ein Schritt, welchen Text hat er, welchen festen Schlüssel?
// Die einzige Stelle dafür – Server (Anzahl, Ziele, Fortschritt) und Anzeige lesen das Ergebnis.
//
// Schritte = Punkte einer klassenlosen <ol> ganz oben. Von Hand getippte Zeilen mit „- “, „• “, „1. “ oder „1) “
// am Anfang werden dabei in so eine Liste umgebaut. Jeder Schritt bekommt einen festen Schlüssel (data-step),
// den ein Ziel aus diesem Schritt speichert – so bleibt der Fortschritt am Schritt, auch wenn sich sein Text ändert.

/** @typedef {{ key: string, text: string }} Step */

/** Zeilenanfang, der einen Schritt markiert: -, –, —, •, * oder „1.“ / „1)“, danach ein Leerzeichen. */
const MARKER = /^\s*(?:[-–—•*]|\d+[.)])\s+/;
/** Gültiger Schlüssel (auch für sanitize.js und goals.js). */
export const STEP_KEY = /^[a-z0-9]{1,16}$/;
const TEXT_MAX = 200;

/** Elemente, die innerhalb einer Zeile stehen – alles andere ist ein eigener Block. */
const INLINE = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SPAN', 'FONT', 'MARK', 'CODE', 'SUB', 'SUP', 'BR']);
const BLOCKS = new Set(['P', 'DIV']);
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** @param {Node} n */
const tag = (n) => n.nodeName.toUpperCase();
/** @param {Node} n */
const isInline = (n) => n.nodeType === TEXT_NODE || INLINE.has(tag(n));
/** Block ohne Klasse (Kästen, Videos usw. haben eine) – nur solche können Schritt-Zeilen sein. @param {Element} el */
const isPlainBlock = (el) => BLOCKS.has(tag(el)) && !el.getAttribute('class');
/** @param {Element} el */
const isStepList = (el) => tag(el) === 'OL' && !el.getAttribute('class');

/** @param {Node[]} nodes */
function splitAtBreaks(nodes) {
	/** @type {Node[][]} */
	const lines = [[]];
	for (const n of nodes) {
		if (tag(n) === 'BR') lines.push([]);
		else lines[lines.length - 1].push(n);
	}
	return lines.filter((line) => line.some((n) => n.textContent?.trim()));
}

/** @param {Node[]} line */
const isStepLine = (line) => MARKER.test(line.map((n) => n.textContent ?? '').join(''));

/**
 * Zeilen (getrennt durch <br>) in eigene Blöcke legen – aber nur, wenn darunter ein Schritt ist.
 * @param {Document} doc
 * @param {Node[]} nodes
 * @param {Node} parent
 * @param {Node | null} ref Einfügen vor diesem Knoten
 * @param {string} name
 */
function toBlocks(doc, nodes, parent, ref, name) {
	const lines = splitAtBreaks(nodes);
	if (!lines.some(isStepLine)) return false;
	for (const line of lines) {
		const block = doc.createElement(name);
		for (const n of line) block.appendChild(n);
		parent.insertBefore(block, ref);
	}
	return true;
}

/** Das Markierungszeichen am Anfang (im ersten Text mit Inhalt) entfernen. @param {Node} node */
function stripMarker(node) {
	for (const child of [...node.childNodes]) {
		if (child.nodeType === TEXT_NODE) {
			if (!child.textContent?.trim()) continue;
			child.textContent = (child.textContent ?? '').replace(MARKER, '');
			return true;
		}
		if (child.nodeType === ELEMENT_NODE && stripMarker(child)) return true;
	}
	return false;
}

/**
 * Aufeinanderfolgende Zeilen mit „- “ oder „1. “ am Anfang in ein <ol> umbauen.
 * @param {Document} doc
 * @param {Element} root
 */
function dashesToSteps(doc, root) {
	// 1. Jede Zeile ein eigener Block: lose Zeilen auf oberster Ebene und Absätze mit <br>.
	/** @type {Node[]} */
	let run = [];
	const flush = () => {
		if (run.length && toBlocks(doc, run, root, run[run.length - 1].nextSibling, 'div')) {
			for (const n of run) if (tag(n) === 'BR') n.parentNode?.removeChild(n);
		}
		run = [];
	};
	for (const n of [...root.childNodes]) {
		if (isInline(n)) {
			run.push(n);
			continue;
		}
		flush();
		const el = /** @type {Element} */ (n);
		if (n.nodeType === ELEMENT_NODE && isPlainBlock(el) && [...el.children].some((c) => tag(c) === 'BR')) {
			if (toBlocks(doc, [...el.childNodes], root, el, tag(el).toLowerCase())) el.remove();
		}
	}
	flush();

	// 2. Aufeinanderfolgende Schritt-Zeilen zu einer Liste zusammenfassen; Leerzeilen dazwischen fallen weg.
	/** @type {Element | null} */
	let ol = null;
	/** @type {Element[]} */
	let blanks = [];
	for (const el of [...root.children]) {
		const block = isPlainBlock(el);
		if (block && MARKER.test(el.textContent ?? '')) {
			// Direkt nach einer echten nummerierten Liste dort weiterzählen.
			const prev = el.previousElementSibling;
			if (!ol && prev && isStepList(prev)) ol = prev;
			if (!ol) {
				ol = doc.createElement('ol');
				root.insertBefore(ol, el);
			}
			blanks.forEach((b) => b.remove());
			blanks = [];
			const li = doc.createElement('li');
			for (const n of [...el.childNodes]) li.appendChild(n);
			stripMarker(li);
			ol.appendChild(li);
			el.remove();
		} else if (ol && block && !el.textContent?.trim() && !el.querySelector('img')) {
			blanks.push(el);
		} else {
			ol = null;
			blanks = [];
		}
	}
}

/**
 * Text eines Schritts: ohne Zusatzzeile (nach dem ersten Zeilenumbruch), ohne Badges und ohne Unterlisten.
 * @param {Element} li
 */
function stepText(li) {
	const clone = /** @type {Element} */ (li.cloneNode(true));
	clone.querySelectorAll('.sub, .step-count, .badge, ul, ol').forEach((el) => el.remove());
	const br = [...clone.childNodes].find((n) => tag(n) === 'BR');
	while (br?.nextSibling) br.nextSibling.remove();
	return (clone.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX);
}

/** Kurzer, gleichbleibender Schlüssel aus Text und Position (FNV-1a). @param {string} seed */
function hashKey(seed) {
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(36);
}

/**
 * Den Inhalt eines Auftrags (bereinigtes HTML) aufbereiten: von Hand getippte Schritte als Liste, jeder Schritt
 * mit festem Schlüssel. Wiederholbar: vorhandene Schlüssel bleiben, doppelte (z. B. beim Enter im Editor
 * mitkopiert) und fehlende werden neu vergeben.
 * @param {string} html
 * @returns {{ html: string, steps: Step[] }}
 */
export function prepareContent(html) {
	if (!html) return { html: '', steps: [] };
	const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
	const root = document.body;
	dashesToSteps(document, root);

	const items = [...root.children].filter(isStepList).flatMap((ol) => [...ol.children].filter((li) => tag(li) === 'LI'));
	// Ein Schritt, der eingerückt wurde (Unterpunkt), ist keiner mehr – Schlüssel weg.
	const stepItems = new Set(items);
	for (const li of root.querySelectorAll('li[data-step]')) if (!stepItems.has(li)) li.removeAttribute('data-step');
	/** @type {Set<string>} */
	const used = new Set();
	/** @type {Step[]} */
	const steps = [];
	items.forEach((li, i) => {
		const text = stepText(li);
		let key = li.getAttribute('data-step') ?? '';
		if (!STEP_KEY.test(key) || used.has(key)) {
			key = hashKey(`${i}:${text}`);
			for (let n = 1; used.has(key); n++) key = hashKey(`${i}:${text}:${n}`);
			li.setAttribute('data-step', key);
		}
		used.add(key);
		if (text) steps.push({ key, text });
	});
	return { html: root.innerHTML, steps };
}
