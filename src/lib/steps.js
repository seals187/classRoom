// Von Hand getippte Schritte („- Seite 10 lesen“, „1. …“) wie eine nummerierte Liste behandeln.

/** Zeilenanfang, der einen Schritt markiert: -, –, —, •, * oder „1.“ / „1)“, danach ein Leerzeichen. */
const MARKER = /^\s*(?:[-–—•*]|\d+[.)])\s+/;

/** Elemente, die innerhalb einer Zeile stehen – alles andere ist ein eigener Block. */
const INLINE = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SPAN', 'FONT', 'MARK', 'CODE', 'SUB', 'SUP', 'BR']);
const BLOCKS = new Set(['P', 'DIV']);

/** @param {Node} n */
const isInline = (n) => n.nodeType === Node.TEXT_NODE || INLINE.has(n.nodeName);

/** @param {Node[]} nodes */
function splitAtBreaks(nodes) {
	/** @type {Node[][]} */
	const lines = [[]];
	for (const n of nodes) {
		if (n.nodeName === 'BR') lines.push([]);
		else lines[lines.length - 1].push(n);
	}
	return lines.filter((line) => line.some((n) => n.textContent?.trim()));
}

/** @param {Node[]} line */
const isStep = (line) => MARKER.test(line.map((n) => n.textContent ?? '').join(''));

/**
 * Zeilen (getrennt durch <br>) in eigene Blöcke legen – aber nur, wenn darunter ein Schritt ist.
 * @param {Node[]} nodes
 * @param {Node} parent
 * @param {Node | null} ref Einfügen vor diesem Knoten
 * @param {string} tag
 */
function toBlocks(nodes, parent, ref, tag) {
	const lines = splitAtBreaks(nodes);
	if (!lines.some(isStep)) return false;
	const doc = /** @type {Document} */ (parent.ownerDocument);
	for (const line of lines) {
		const block = doc.createElement(tag);
		block.append(...line);
		parent.insertBefore(block, ref);
	}
	return true;
}

/** Das Markierungszeichen am Anfang entfernen. @param {Element} el */
function stripMarker(el) {
	const walker = /** @type {Document} */ (el.ownerDocument).createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let t = walker.nextNode(); t; t = walker.nextNode()) {
		if (!t.textContent?.trim()) continue;
		t.textContent = t.textContent.replace(MARKER, '');
		return;
	}
}

/**
 * Aufeinanderfolgende Zeilen mit „- “ oder „1. “ am Anfang in ein <ol> umbauen, damit sie als
 * Schritte erscheinen (Zahl im Kreis, Fortschritt, „Als Stundenziele“). Ändert nur den übergebenen
 * Knoten – das gespeicherte HTML bleibt unverändert.
 * @param {Element} root
 */
export function dashesToSteps(root) {
	const doc = /** @type {Document} */ (root.ownerDocument);

	// 1. Jede Zeile ein eigener Block: lose Zeilen auf oberster Ebene und Absätze mit <br>.
	/** @type {Node[]} */
	let run = [];
	const flush = () => {
		if (run.length && toBlocks(run, root, run[run.length - 1].nextSibling, 'div')) {
			for (const n of run) if (n.nodeName === 'BR') n.remove();
		}
		run = [];
	};
	for (const n of [...root.childNodes]) {
		if (isInline(n)) {
			run.push(n);
			continue;
		}
		flush();
		if (BLOCKS.has(n.nodeName) && /** @type {Element} */ (n).querySelector(':scope > br')) {
			if (toBlocks([...n.childNodes], root, n, n.nodeName.toLowerCase())) /** @type {Element} */ (n).remove();
		}
	}
	flush();

	// 2. Aufeinanderfolgende Schritt-Zeilen zu einer Liste zusammenfassen; Leerzeilen dazwischen fallen weg.
	/** @type {HTMLOListElement | null} */
	let ol = null;
	/** @type {Element[]} */
	let blanks = [];
	for (const el of [...root.children]) {
		const block = BLOCKS.has(el.nodeName);
		if (block && MARKER.test(el.textContent ?? '')) {
			// Direkt nach einer echten nummerierten Liste dort weiterzählen.
			const prev = el.previousElementSibling;
			if (!ol && prev?.nodeName === 'OL') ol = /** @type {HTMLOListElement} */ (prev);
			if (!ol) {
				ol = doc.createElement('ol');
				el.before(ol);
			}
			blanks.forEach((b) => b.remove());
			blanks = [];
			const li = doc.createElement('li');
			li.append(...el.childNodes);
			stripMarker(li);
			ol.append(li);
			el.remove();
		} else if (ol && block && !el.textContent?.trim() && !el.querySelector('img')) {
			blanks.push(el);
		} else {
			ol = null;
			blanks = [];
		}
	}
}
