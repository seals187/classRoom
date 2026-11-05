// Bausteine des Auftrags-Editors: Listenarten mit Unterlisten, Tabellen, Hinweis-Kästen, Badges,
// Video und ein eigenes Rückgängig/Wiederholen (DOM-Änderungen landen nicht im Verlauf des Browsers).

/** Listenarten: Tag + Klasse. „Schritte“ ist die klassenlose <ol> (große Zahl im Kreis, wie bisher). */
export const LIST_TYPES = /** @type {const} */ ({
	bullets: { tag: 'UL', cls: '' },
	nums: { tag: 'OL', cls: 'nums' },
	steps: { tag: 'OL', cls: '' },
	check: { tag: 'UL', cls: 'check' },
	letters: { tag: 'OL', cls: 'letters' },
	arrows: { tag: 'UL', cls: 'arrows' },
	stars: { tag: 'UL', cls: 'stars' }
});

/** @typedef {keyof typeof LIST_TYPES} ListType */

/** @param {Node | null | undefined} n */
export const isList = (n) => n?.nodeName === 'UL' || n?.nodeName === 'OL';

/** @param {Element} el @param {string} cls */
function setClass(el, cls) {
	if (cls) el.className = cls;
	else el.removeAttribute('class');
}

/**
 * Art einer Liste. Eine klassenlose <ol> in einer Unterliste sieht aus wie „Nummern“.
 * @param {Element} list
 * @returns {ListType}
 */
export function listTypeOf(list) {
	const cls = list.getAttribute('class') ?? '';
	for (const [key, t] of Object.entries(LIST_TYPES)) {
		if (t.tag === list.nodeName && t.cls === cls) {
			if (key === 'steps' && list.parentElement?.closest('li')) return 'nums';
			return /** @type {ListType} */ (key);
		}
	}
	return list.nodeName === 'OL' ? 'nums' : 'bullets';
}

// --- Auswahl ---

/** @param {Element} root @param {Node} node @param {number} offset */
function pathOf(root, node, offset) {
	const path = [];
	for (let n = node; n && n !== root; n = /** @type {Node} */ (n.parentNode)) {
		if (!n.parentNode) return null;
		path.unshift([...n.parentNode.childNodes].indexOf(/** @type {ChildNode} */ (n)));
	}
	return { path, offset };
}

/** @param {Element} root @param {{ path: number[], offset: number } | null} p */
function nodeAt(root, p) {
	if (!p) return null;
	/** @type {Node} */
	let n = root;
	for (const i of p.path) {
		const next = n.childNodes[i];
		if (!next) return null;
		n = next;
	}
	const max = n.nodeType === Node.TEXT_NODE ? (n.textContent ?? '').length : n.childNodes.length;
	return { node: n, offset: Math.min(p.offset, max) };
}

/** Auswahl als Pfad merken – überlebt das Ersetzen des HTML (Rückgängig) und das Umhängen von Knoten. @param {Element} root */
export function saveSelection(root) {
	const sel = document.getSelection();
	if (!sel?.rangeCount) return null;
	const r = sel.getRangeAt(0);
	if (!root.contains(r.startContainer)) return null;
	return { start: pathOf(root, r.startContainer, r.startOffset), end: pathOf(root, r.endContainer, r.endOffset) };
}

/** @param {Element} root @param {ReturnType<typeof saveSelection>} saved */
export function restoreSelection(root, saved) {
	const start = saved && nodeAt(root, saved.start);
	const end = saved && nodeAt(root, saved.end);
	const range = document.createRange();
	if (start && end) {
		range.setStart(start.node, start.offset);
		range.setEnd(end.node, end.offset);
	} else {
		range.selectNodeContents(root);
		range.collapse(false);
	}
	const sel = document.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
}

/** Cursor an den Anfang eines Elements setzen. @param {Node} el */
export function caretInto(el) {
	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(true);
	const sel = document.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
}

/** Knoten, in dem der Cursor steht (nur innerhalb des Editors). @param {Element} root */
export function anchorIn(root) {
	const sel = document.getSelection();
	const node = sel?.rangeCount ? sel.getRangeAt(0).startContainer : null;
	return node && root.contains(node) ? node : null;
}

/** @param {Node | null} node @param {string} selector @param {Element} root */
export function closestIn(node, selector, root) {
	const el = node?.nodeType === Node.ELEMENT_NODE ? /** @type {Element} */ (node) : node?.parentElement;
	const found = el?.closest(selector);
	return found && root.contains(found) && found !== root ? found : null;
}

// --- Verlauf (Rückgängig / Wiederholen) ---

export class History {
	/** @param {HTMLElement} el */
	constructor(el) {
		this.el = el;
		/** @type {{ html: string, sel: ReturnType<typeof saveSelection> }[]} */
		this.stack = [];
		this.index = -1;
		/** @type {ReturnType<typeof setTimeout> | undefined} */
		this.timer = undefined;
	}

	snapshot() {
		return { html: this.el.innerHTML, sel: saveSelection(this.el) };
	}

	reset() {
		clearTimeout(this.timer);
		this.timer = undefined;
		this.stack = [this.snapshot()];
		this.index = 0;
	}

	/** Aktuellen Stand festhalten (nach jeder Änderung). */
	record() {
		clearTimeout(this.timer);
		this.timer = undefined;
		const s = this.snapshot();
		const current = this.stack[this.index];
		if (current?.html === s.html) {
			current.sel = s.sel;
			return;
		}
		this.stack.splice(this.index + 1);
		this.stack.push(s);
		if (this.stack.length > 200) this.stack.shift();
		this.index = this.stack.length - 1;
	}

	/** Beim Tippen: erst nach einer kurzen Pause festhalten (ein Schritt pro Wort statt pro Buchstabe). */
	schedule() {
		clearTimeout(this.timer);
		this.timer = setTimeout(() => this.record(), 500);
	}

	/** Vor einer eigenen Änderung: begonnenes Tippen abschließen. */
	flush() {
		if (this.timer !== undefined) this.record();
	}

	get canUndo() {
		return this.index > 0 || (this.timer !== undefined && this.stack.length > 0);
	}

	get canRedo() {
		return this.index < this.stack.length - 1;
	}

	undo() {
		this.flush();
		if (this.index <= 0) return;
		this.index--;
		this.apply(this.stack[this.index]);
	}

	redo() {
		this.flush();
		if (this.index >= this.stack.length - 1) return;
		this.index++;
		this.apply(this.stack[this.index]);
	}

	/** @param {{ html: string, sel: ReturnType<typeof saveSelection> }} s */
	apply(s) {
		this.el.innerHTML = s.html;
		this.el.focus();
		restoreSelection(this.el, s.sel);
	}
}

// --- Listen ---

/**
 * Listenart setzen: in einer Liste deren Art ändern (bei gleicher Art: Liste aufheben), sonst neue Liste.
 * In einer Unterliste gilt das für die Unterliste.
 * @param {HTMLElement} root
 * @param {ListType} type
 */
export function setListType(root, type) {
	const t = LIST_TYPES[type];
	const list = closestIn(anchorIn(root), 'ul, ol', root);
	const command = (/** @type {string} */ tag) => (tag === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
	if (list) {
		if (listTypeOf(list) === type) {
			document.execCommand(command(list.nodeName));
			return;
		}
		const saved = saveSelection(root);
		const nested = !!list.parentElement?.closest('li');
		// Schritte gibt es nur oben; in einer Unterliste wäre die klassenlose <ol> „Nummern“.
		const next = document.createElement(t.tag);
		setClass(next, nested && type === 'steps' ? 'nums' : t.cls);
		next.append(...list.childNodes);
		list.replaceWith(next);
		restoreSelection(root, saved);
		return;
	}
	document.execCommand(command(t.tag));
	const created = closestIn(anchorIn(root), 'ul, ol', root);
	if (created && created.nodeName === t.tag) setClass(created, t.cls);
}

/** Listenpunkt eine Ebene tiefer (Tab): wird Unterliste des vorherigen Punkts. @param {HTMLElement} root */
export function indent(root) {
	const li = closestIn(anchorIn(root), 'li', root);
	if (!li) return false;
	const prev = li.previousElementSibling;
	if (prev?.nodeName !== 'LI') return true;
	const saved = saveWithin(li);
	const parent = /** @type {Element} */ (li.parentElement);
	let sub = isList(prev.lastElementChild) ? prev.lastElementChild : null;
	if (!sub) {
		sub = document.createElement(parent.nodeName);
		const type = listTypeOf(parent);
		// Unter Schritten: Teilaufgaben a) b) c); sonst dieselbe Art.
		setClass(sub, type === 'steps' ? 'letters' : (parent.getAttribute('class') ?? ''));
		prev.append(sub);
	}
	// Eigene Unterpunkte wandern mit (eine Ebene tiefer).
	sub.append(li);
	restoreWithin(li, saved);
	return true;
}

/** Listenpunkt eine Ebene höher (Umschalt+Tab). Ganz oben: Punkt wird normaler Absatz. @param {HTMLElement} root */
export function outdent(root) {
	const li = closestIn(anchorIn(root), 'li', root);
	if (!li) return false;
	const list = /** @type {Element} */ (li.parentElement);
	const parentLi = list.parentElement?.nodeName === 'LI' ? list.parentElement : null;
	if (!parentLi) {
		document.execCommand(list.nodeName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
		return true;
	}
	const saved = saveWithin(li);
	// Folgende Punkte werden Unterpunkte des herausgerückten Punkts.
	const after = [];
	for (let n = li.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
	if (after.length) {
		let sub = isList(li.lastElementChild) ? li.lastElementChild : null;
		if (!sub) {
			sub = document.createElement(list.nodeName);
			setClass(sub, list.getAttribute('class') ?? '');
			li.append(sub);
		}
		sub.append(...after);
	}
	parentLi.after(li);
	if (!list.children.length) list.remove();
	restoreWithin(li, saved);
	return true;
}

/** Auswahl relativ zu einem Element merken – überlebt das Verschieben des Elements. @param {Element} el */
function saveWithin(el) {
	const sel = document.getSelection();
	if (!sel?.rangeCount) return null;
	const r = sel.getRangeAt(0);
	if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
	return { start: pathOf(el, r.startContainer, r.startOffset), end: pathOf(el, r.endContainer, r.endOffset) };
}

/** @param {Element} el @param {ReturnType<typeof saveWithin>} saved */
function restoreWithin(el, saved) {
	const start = saved && nodeAt(el, saved.start);
	const end = saved && nodeAt(el, saved.end);
	if (!start || !end) return caretInto(el);
	const range = document.createRange();
	range.setStart(start.node, start.offset);
	range.setEnd(end.node, end.offset);
	const sel = document.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
}

// --- Blöcke (Tabelle, Kasten, Video, Linie) ---

/** Block auf oberster Ebene, in dem der Cursor steht (oder null, wenn direkt im Editor). @param {HTMLElement} root */
function topBlock(root) {
	let n = anchorIn(root);
	while (n && n.parentNode !== root) n = n.parentNode;
	return n && n !== root ? n : null;
}

/** @param {Node} n */
const isBlank = (n) =>
	!(n.textContent ?? '').replace(/ /g, ' ').trim() &&
	!(n.nodeType === Node.ELEMENT_NODE && /** @type {Element} */ (n).querySelector('img, table, hr, .video, .badge'));

/**
 * Block an der Cursorstelle einfügen: ersetzt einen leeren Absatz, sonst danach. Danach immer
 * ein Absatz, damit man unter dem Block weiterschreiben kann.
 * @param {HTMLElement} root
 * @param {HTMLElement} block
 */
function insertBlock(root, block) {
	const at = topBlock(root);
	if (at && isBlank(at) && at.nodeName !== 'TABLE') at.replaceWith(block);
	else if (at) /** @type {ChildNode} */ (at).after(block);
	else root.append(block);
	if (!block.nextSibling || block.nextSibling.nodeType !== Node.ELEMENT_NODE) {
		const p = document.createElement('p');
		p.append(document.createElement('br'));
		block.after(p);
	}
}

/** @param {string} tag */
function emptyCell(tag) {
	const c = document.createElement(tag);
	c.append(document.createElement('br'));
	return c;
}

/** Tabelle mit Kopfzeile einfügen. @param {HTMLElement} root @param {number} cols @param {number} rows */
export function insertTable(root, cols, rows) {
	const table = document.createElement('table');
	const thead = table.createTHead();
	const head = thead.insertRow();
	for (let c = 0; c < cols; c++) head.append(emptyCell('th'));
	const body = table.createTBody();
	for (let r = 1; r < rows; r++) {
		const tr = body.insertRow();
		for (let c = 0; c < cols; c++) tr.append(emptyCell('td'));
	}
	insertBlock(root, table);
	caretInto(head.cells[0]);
}

/** @param {HTMLElement} root */
export const cellAt = (root) => /** @type {HTMLTableCellElement | null} */ (closestIn(anchorIn(root), 'td, th', root));

/** Markierte Zellen (ohne Markierung: die Zelle mit dem Cursor). @param {HTMLElement} root */
export function selectedCells(root) {
	const cell = cellAt(root);
	const sel = document.getSelection();
	if (!sel?.rangeCount) return cell ? [cell] : [];
	const range = sel.getRangeAt(0);
	const table = cell?.closest('table') ?? closestIn(range.commonAncestorContainer, 'table', root);
	if (!table) return [];
	if (range.collapsed) return cell ? [cell] : [];
	const cells = [...table.querySelectorAll('td, th')].filter((c) => range.intersectsNode(c));
	return /** @type {HTMLTableCellElement[]} */ (cells.length ? cells : cell ? [cell] : []);
}

/**
 * Zeilen/Spalten der Tabelle mit dem Cursor ändern.
 * @param {HTMLElement} root
 * @param {'addRow' | 'addCol' | 'delRow' | 'delCol' | 'header' | 'delete'} action
 */
export function tableAction(root, action) {
	const cell = cellAt(root);
	const table = /** @type {HTMLTableElement | null} */ (cell?.closest('table') ?? null);
	if (!cell || !table) return;
	const row = /** @type {HTMLTableRowElement} */ (cell.parentElement);
	const col = cell.cellIndex;
	const inHead = row.parentElement?.nodeName === 'THEAD';

	if (action === 'addRow') {
		const tr = document.createElement('tr');
		for (let c = 0; c < row.cells.length; c++) tr.append(emptyCell('td'));
		if (inHead) {
			const body = table.tBodies[0] ?? table.createTBody();
			body.prepend(tr);
		} else row.after(tr);
		caretInto(tr.cells[Math.min(col, tr.cells.length - 1)]);
	} else if (action === 'addCol') {
		for (const tr of table.rows) {
			const next = emptyCell(tr.parentElement?.nodeName === 'THEAD' ? 'th' : 'td');
			const ref = tr.cells[col];
			if (ref) ref.after(next);
			else tr.append(next);
		}
		caretInto(row.cells[col + 1]);
	} else if (action === 'delRow') {
		if (table.rows.length <= 1) return removeTable(table);
		const target = row.nextElementSibling ?? row.previousElementSibling;
		const section = row.parentElement;
		row.remove();
		if (section && !section.children.length) section.remove();
		const nextRow = /** @type {HTMLTableRowElement | null} */ (target) ?? table.rows[0];
		caretInto(nextRow.cells[Math.min(col, nextRow.cells.length - 1)]);
	} else if (action === 'delCol') {
		if (row.cells.length <= 1) return removeTable(table);
		for (const tr of table.rows) tr.cells[col]?.remove();
		caretInto(row.cells[Math.min(col, row.cells.length - 1)]);
	} else if (action === 'header') {
		if (table.tHead) {
			// Kopfzeile wird normale Zeile.
			const body = table.tBodies[0] ?? table.createTBody();
			for (const tr of [...table.tHead.rows].reverse()) {
				for (const th of [...tr.cells]) th.replaceWith(retag(th, 'td'));
				body.prepend(tr);
			}
			table.tHead.remove();
		} else {
			const first = table.rows[0];
			const thead = table.createTHead();
			for (const td of [...first.cells]) td.replaceWith(retag(td, 'th'));
			thead.append(first);
			const body = table.tBodies[0];
			if (body && !body.rows.length) body.remove();
		}
		const r = table.rows[row.rowIndex >= 0 ? row.rowIndex : 0] ?? table.rows[0];
		caretInto(r.cells[Math.min(col, r.cells.length - 1)]);
	} else if (action === 'delete') {
		removeTable(table);
	}
}

/** @param {HTMLTableElement} table */
function removeTable(table) {
	const p = document.createElement('p');
	p.append(document.createElement('br'));
	table.replaceWith(p);
	caretInto(p);
}

/** @param {Element} el @param {string} tag */
function retag(el, tag) {
	const next = document.createElement(tag);
	for (const a of el.attributes) next.setAttribute(a.name, a.value);
	next.append(...el.childNodes);
	return next;
}

/** Zellfarben (Klassen, damit sie sich Hell/Dunkel anpassen). */
export const CELL_COLORS = /** @type {const} */ ([
	{ cls: 'c-yellow', name: 'Gelb' },
	{ cls: 'c-green', name: 'Grün' },
	{ cls: 'c-blue', name: 'Blau' },
	{ cls: 'c-red', name: 'Rot' },
	{ cls: 'c-purple', name: 'Lila' }
]);

/** @param {HTMLElement} root @param {string} cls leer = Farbe entfernen */
export function colorCells(root, cls) {
	for (const cell of selectedCells(root)) setClass(cell, cls);
}

/** Tab in einer Tabelle: zur nächsten (vorherigen) Zelle; nach der letzten kommt eine neue Zeile. @param {HTMLElement} root @param {boolean} back */
export function moveCell(root, back) {
	const cell = cellAt(root);
	const table = cell?.closest('table');
	if (!cell || !table) return false;
	const cells = [...table.querySelectorAll('th, td')];
	const i = cells.indexOf(cell) + (back ? -1 : 1);
	if (i < 0) return true;
	if (i >= cells.length) {
		tableAction(root, 'addRow');
		return true;
	}
	const range = document.createRange();
	range.selectNodeContents(cells[i]);
	const sel = document.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
	return true;
}

/** Hinweis-Kästen: Material, Tipp, Wichtig. */
export const BOXES = /** @type {const} */ ({
	material: 'Material',
	tip: 'Tipp',
	warn: 'Wichtig'
});

/** @param {HTMLElement} root @param {keyof typeof BOXES} kind */
export function insertBox(root, kind) {
	const box = document.createElement('div');
	box.className = `box ${kind}`;
	const p = document.createElement('p');
	p.append(document.createElement('br'));
	box.append(p);
	insertBlock(root, box);
	caretInto(p);
}

export function insertRule(/** @type {HTMLElement} */ root) {
	const hr = document.createElement('hr');
	insertBlock(root, hr);
	if (hr.nextElementSibling) caretInto(hr.nextElementSibling);
}

/** YouTube-Adresse → Video-ID (11 Zeichen) oder null. @param {string} url */
export function youtubeId(url) {
	const m = url
		.trim()
		.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
	return m ? m[1] : /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}

/** @param {HTMLElement} root @param {string} id */
export function insertVideo(root, id) {
	const div = document.createElement('div');
	div.className = 'video';
	div.dataset.yt = id;
	div.textContent = `youtu.be/${id}`;
	div.contentEditable = 'false';
	insertBlock(root, div);
	if (div.nextElementSibling) caretInto(div.nextElementSibling);
}

/** Badges im Text (Zeit, Sozialform, Profi) – im Editor ein Stück, das als Ganzes gelöscht wird. */
export const BADGES = /** @type {const} */ ({ time: '⏱', social: '👥', profi: '★' });

/** @param {HTMLElement} root @param {keyof typeof BADGES} kind @param {string} text */
export function insertBadge(root, kind, text) {
	const span = document.createElement('span');
	span.className = `badge ${kind}`;
	span.textContent = text;
	span.contentEditable = 'false';
	const sel = document.getSelection();
	if (!sel?.rangeCount || !root.contains(sel.getRangeAt(0).startContainer)) {
		root.append(span);
		return;
	}
	const range = sel.getRangeAt(0);
	range.collapse(false);
	range.insertNode(span);
	// Cursor hinter das Badge.
	const after = document.createRange();
	after.setStartAfter(span);
	after.collapse(true);
	sel.removeAllRanges();
	sel.addRange(after);
}

/** Beim Laden in den Editor: Badges und Videos nicht bearbeitbar (das Attribut wird beim Speichern entfernt). @param {HTMLElement} root */
export function prepareEditable(root) {
	for (const el of root.querySelectorAll('.badge, .video')) /** @type {HTMLElement} */ (el).contentEditable = 'false';
}

/**
 * Enter/Backspace an Kästen und Unterlisten:
 * - Enter im leeren letzten Absatz eines Kastens → Kasten verlassen.
 * - Backspace im leeren Kasten → Kasten entfernen.
 * - Enter im leeren Punkt einer Unterliste → eine Ebene höher.
 * @param {HTMLElement} root @param {KeyboardEvent} e
 * @returns {boolean} behandelt
 */
export function handleBlockKeys(root, e) {
	const anchor = anchorIn(root);
	const sel = document.getSelection();
	if (!anchor || !sel?.isCollapsed) return false;
	const box = closestIn(anchor, '.box', root);
	const li = closestIn(anchor, 'li', root);

	if (e.key === 'Enter' && !e.shiftKey && li && isBlank(li)) {
		const list = /** @type {Element} */ (li.parentElement);
		if (list.parentElement?.nodeName === 'LI') return outdent(root);
		// Liste verlassen: normaler Absatz (sonst übernimmt der Browser Schriftgröße und Fett der Schritte).
		const p = document.createElement('p');
		p.append(document.createElement('br'));
		const after = [];
		for (let n = li.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
		list.after(p);
		if (after.length) {
			const rest = document.createElement(list.nodeName);
			setClass(rest, list.getAttribute('class') ?? '');
			rest.append(...after);
			p.after(rest);
		}
		li.remove();
		if (!list.children.length) list.remove();
		caretInto(p);
		return true;
	}
	if (!box || (li && box.contains(li))) return false;
	const para = closestIn(anchor, 'p, div, h3, h4', root);
	const block = para && para !== box && box.contains(para) ? para : null;

	if (e.key === 'Enter' && !e.shiftKey && block && isBlank(block) && block === box.lastElementChild && box.children.length > 1) {
		const p = document.createElement('p');
		p.append(document.createElement('br'));
		block.remove();
		box.after(p);
		caretInto(p);
		return true;
	}
	if (e.key === 'Backspace' && isBlank(box)) {
		const p = document.createElement('p');
		p.append(document.createElement('br'));
		box.replaceWith(p);
		caretInto(p);
		return true;
	}
	return false;
}

/** Art des Absatzes an der Cursorstelle. @param {HTMLElement} root @returns {'p' | 'h3' | 'h4'} */
export function blockTypeAt(root) {
	const el = closestIn(anchorIn(root), 'h3, h4', root);
	return el ? /** @type {'h3' | 'h4'} */ (el.nodeName.toLowerCase()) : 'p';
}
