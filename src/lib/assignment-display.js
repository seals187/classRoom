// Anzeige eines Auftrags im Browser: aus dem gespeicherten HTML die fertige Ansicht machen. Ändert nur den
// übergebenen Knoten – das gespeicherte HTML bleibt unverändert. Schritte (li[data-step]) hat der Server schon
// erkannt (siehe #lib/server/assignment-content.js).

/** Ein Schritt in der Anzeige. */
const STEP = 'li[data-step]';
/** Merkspeicher fürs Abhaken der Checklisten (pro Gerät). */
const CHECKS_KEY = 'assignmentChecks';

/**
 * @typedef {{
 *   checkScope: string,
 *   storage?: Pick<Storage, 'getItem' | 'setItem'> | null
 * }} DisplayOptions
 * checkScope: wofür die Häkchen gelten (Auftrag), storage: Speicher fürs Abhaken (Standard: localStorage)
 */

/** @param {Element} root */
const docOf = (root) => /** @type {Document} */ (root.ownerDocument);

/** Links: nur die Adresse ohne https:// und www. zeigen, wenn der Text die Adresse selbst ist. @param {Element} root */
function shortenLinks(root) {
	for (const a of root.querySelectorAll('a')) {
		const href = a.getAttribute('href') ?? '';
		if (a.textContent?.trim() !== href) continue;
		a.textContent = href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
	}
}

/** Absätze am Ende, die nur Links enthalten, unten in der Karte sammeln. @param {Element} root */
function collectTrailingLinks(root) {
	if ([...root.children].some((c) => c.classList.contains('links'))) return;
	/** @param {Element} el */
	const onlyLinks = (el) =>
		el.querySelector('a') !== null &&
		[...el.childNodes].every((n) => n.nodeName === 'A' || n.nodeName === 'BR' || !n.textContent?.trim());
	/** @param {Element} el */
	const blank = (el) => !el.textContent?.trim() && !el.querySelector('img');
	/** @type {Element[]} */
	const tail = [];
	let el = root.lastElementChild;
	while (el && (onlyLinks(el) || blank(el))) {
		const prev = el.previousElementSibling;
		if (onlyLinks(el)) tail.unshift(el);
		else el.remove();
		el = prev;
	}
	if (!tail.length) return;
	const links = docOf(root).createElement('div');
	links.className = 'links';
	links.append(...tail);
	root.append(links);
}

/** Text nach dem ersten Zeilenumbruch (Umschalt+Enter) eines Schritts als graue Zusatzzeile. @param {Element} root */
function subLines(root) {
	for (const li of root.querySelectorAll(STEP)) {
		if ([...li.children].some((c) => c.classList.contains('sub'))) continue;
		const br = [...li.childNodes].find((n) => n.nodeName === 'BR');
		// Zusatzzeile nur bis zu einer Unterliste.
		const isSubEnd = (/** @type {Node | null} */ n) => !n || n.nodeName === 'UL' || n.nodeName === 'OL';
		if (!br || isSubEnd(br.nextSibling)) continue;
		const sub = docOf(root).createElement('span');
		sub.className = 'sub';
		while (!isSubEnd(br.nextSibling)) sub.appendChild(/** @type {Node} */ (br.nextSibling));
		br.replaceWith(sub);
	}
}

/** Video-Baustein: YouTube-Player (ohne Cookies bis zum Abspielen). @param {Element} root */
function videos(root) {
	for (const el of root.querySelectorAll('.video[data-yt]')) {
		const id = el.getAttribute('data-yt') ?? '';
		if (!/^[\w-]{11}$/.test(id) || el.querySelector('iframe')) continue;
		const frame = docOf(root).createElement('iframe');
		frame.setAttribute('src', `https://www.youtube-nocookie.com/embed/${id}`);
		frame.setAttribute('title', 'YouTube-Video');
		frame.setAttribute('allow', 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen');
		frame.setAttribute('allowfullscreen', '');
		frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
		frame.setAttribute('loading', 'lazy');
		el.textContent = '';
		el.appendChild(frame);
	}
}

/** @param {DisplayOptions['storage']} storage @returns {Record<string, string[]>} */
function readChecks(storage) {
	try {
		return JSON.parse(storage?.getItem(CHECKS_KEY) ?? '{}') ?? {};
	} catch {
		return {};
	}
}

/**
 * Checklisten: Schüler haken auf ihrem Gerät ab (gemerkt pro Auftrag und Punkt).
 * @param {Element} root
 * @param {string} scope
 * @param {DisplayOptions['storage']} storage
 */
function checklists(root, scope, storage) {
	const items = [...root.querySelectorAll('ul.check > li')];
	/** @param {Element} li @param {number} i */
	const keyOf = (li, i) => {
		const clone = /** @type {Element} */ (li.cloneNode(true));
		clone.querySelectorAll('ul, ol').forEach((el) => el.remove());
		return `${i}:${(clone.textContent ?? '').trim().slice(0, 80)}`;
	};
	const done = new Set(readChecks(storage)[scope] ?? []);
	items.forEach((li, i) => {
		const key = keyOf(li, i);
		/** @param {boolean} on */
		const mark = (on) => {
			li.classList.toggle('done', on);
			li.setAttribute('aria-checked', String(on));
		};
		mark(done.has(key));
		li.setAttribute('role', 'checkbox');
		li.setAttribute('tabindex', '0');
		const toggle = (/** @type {Event} */ e) => {
			// Nur der eigene Punkt, nicht Links und nicht Unterpunkte.
			const target = /** @type {Element} */ (e.target);
			if (target.closest('a') || target.closest('li') !== li) return;
			if (e.type === 'keydown' && !['Enter', ' '].includes(/** @type {KeyboardEvent} */ (e).key)) return;
			e.preventDefault();
			const all = readChecks(storage);
			const set = new Set(all[scope] ?? []);
			if (set.has(key)) set.delete(key);
			else set.add(key);
			all[scope] = [...set];
			try {
				storage?.setItem(CHECKS_KEY, JSON.stringify(all));
			} catch {
				// Gilt dann nur bis zum Neuladen.
			}
			mark(set.has(key));
		};
		li.addEventListener('click', toggle);
		li.addEventListener('keydown', toggle);
	});
}

/** @returns {DisplayOptions['storage']} */
function defaultStorage() {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

/**
 * Das HTML eines Auftrags für die Anzeige aufbereiten: kurze Links, Links am Ende gesammelt, Zusatzzeilen der
 * Schritte, YouTube-Player, abhakbare Checklisten.
 * @param {Element} root
 * @param {DisplayOptions} options
 */
export function decorateAssignment(root, { checkScope, storage = defaultStorage() }) {
	shortenLinks(root);
	collectTrailingLinks(root);
	subLines(root);
	videos(root);
	checklists(root, checkScope, storage);
}

/**
 * An jedem Schritt: wie viele Schüler ihn als Ziel erledigt haben (z. B. „✓ 7/11“).
 * @param {Element} root
 * @param {Record<string, { done: number, total: number }>} stats nach Schritt-Schlüssel (siehe #lib/steps.js)
 */
export function showStepProgress(root, stats) {
	for (const li of root.querySelectorAll(STEP)) {
		const entry = stats[li.getAttribute('data-step') ?? ''];
		let badge = [...li.children].find((c) => c.classList.contains('step-count')) ?? null;
		if (!entry || entry.total === 0) {
			badge?.remove();
			continue;
		}
		if (!badge) {
			badge = docOf(root).createElement('span');
			badge.className = 'step-count';
			li.append(badge);
		}
		badge.classList.toggle('all', entry.done === entry.total);
		badge.textContent = `✓ ${entry.done}/${entry.total}`;
		badge.setAttribute('title', `${entry.done} von ${entry.total} Schülern erledigt`);
	}
}

/**
 * Eine Stufe größer (+1) oder kleiner (−1); Zwischenwerte (alte Einstellung) springen zur nächsten Stufe.
 * @param {number[]} levels aufsteigend
 * @param {number} current
 * @param {number} dir
 */
export function nextLevel(levels, current, dir) {
	const i = levels.findIndex((v) => v >= current);
	const at = i === -1 ? levels.length - 1 : i;
	const target = levels[at] > current && dir > 0 ? at : at + dir;
	return levels[Math.min(levels.length - 1, Math.max(0, target))];
}
