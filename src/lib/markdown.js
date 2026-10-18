// Kleiner, sicherer Markdown-Renderer für den Auftrag. Alles wird zuerst HTML-escaped,
// erst danach werden die wenigen erlaubten Auszeichnungen in Tags umgewandelt.
//
// Unterstützt: # Überschrift, **fett**, *kursiv*, - Liste, 1. Liste, [Text](URL),
// ![Bild](URL) und nackte https://-Links. Erlaubt sind nur http(s)-, mailto- und eigene Bild-URLs.

/** @type {Record<string, string>} */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** @param {string} s */
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** @param {string} escapedUrl */
function safeUrl(escapedUrl) {
	const raw = escapedUrl.replace(/&amp;/g, '&');
	if (/^(https?:\/\/|mailto:)/i.test(raw) || /^\/api\/files\/\d+$/.test(raw)) return escapedUrl;
	return null;
}

/** @param {string} url */
const link = (url, label = url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;

/**
 * Nackte URL vom nachfolgenden Satzzeichen trennen. Klammern bleiben, wenn sie zur URL gehören
 * (z. B. https://de.wikipedia.org/wiki/Bruch_(Mathematik)).
 * @param {string} match bereits escaped
 * @returns {[url: string, rest: string]}
 */
function splitUrl(match) {
	const entity = match.search(/&(quot|#39|lt|gt);/);
	let url = entity === -1 ? match : match.slice(0, entity);
	const count = (/** @type {string} */ c) => url.split(c).length - 1;
	while (/[.,;:!?)]$/.test(url) && !(url.endsWith(')') && count('(') >= count(')'))) url = url.slice(0, -1);
	return [url, match.slice(url.length)];
}

/** @param {string} raw */
function inline(raw) {
	/** @type {string[]} */
	const tokens = [];
	// Fertiges HTML zwischenparken, damit spätere Regeln (Autolinks, fett …) es nicht anfassen.
	/** @param {string} html */
	const keep = (html) => `\u0000${tokens.push(html) - 1}\u0000`;

	let s = escapeHtml(raw);
	s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
		const u = safeUrl(url);
		// Als Link verpackt: per Tastatur erreichbar, und ohne JavaScript öffnet sich das Bild direkt.
		return u
			? keep(`<a href="${u}" class="zoom" target="_blank" rel="noopener"><img src="${u}" alt="${alt}" loading="lazy"></a>`)
			: m;
	});
	s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
		const u = safeUrl(url);
		return u ? keep(link(u, label)) : m;
	});
	s = s.replace(/https?:\/\/[^\s<]+/g, (match) => {
		const [url, rest] = splitUrl(match);
		return /^https?:\/\/./.test(url) ? keep(link(url)) + rest : match;
	});
	s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>');
	return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
}

/** @param {string} source */
export function renderMarkdown(source) {
	/** @type {string[]} */
	const out = [];
	/** @type {string[]} */
	let paragraph = [];
	/** @type {{ type: 'ul' | 'ol', items: string[] } | null} */
	let list = null;

	const flushParagraph = () => {
		if (paragraph.length) out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
		paragraph = [];
	};
	const flushList = () => {
		if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
		list = null;
	};

	for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
		const heading = /^(#{1,3})\s+(.*)$/.exec(line);
		const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
		const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

		if (!line.trim()) {
			flushParagraph();
			flushList();
		} else if (heading) {
			flushParagraph();
			flushList();
			const level = heading[1].length + 2;
			out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
		} else if (bullet || numbered) {
			flushParagraph();
			const type = bullet ? 'ul' : 'ol';
			if (list?.type !== type) {
				flushList();
				list = { type, items: [] };
			}
			list.items.push(/** @type {RegExpExecArray} */ (bullet ?? numbered)[1]);
		} else {
			flushList();
			paragraph.push(line);
		}
	}
	flushParagraph();
	flushList();
	return out.join('\n');
}
