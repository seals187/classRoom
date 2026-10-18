import sanitizeHtml from 'sanitize-html';

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/i];

/** @type {sanitizeHtml.IOptions} */
const OPTIONS = {
	allowedTags: ['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'span', 'h3', 'h4'],
	allowedAttributes: {
		a: ['href', 'target', 'rel'],
		'*': ['style']
	},
	// Nur die Formatierungen aus der Werkzeugleiste.
	allowedStyles: {
		'*': {
			color: COLOR,
			'font-weight': [/^(bold|[6-9]00)$/],
			'font-style': [/^italic$/],
			'text-decoration': [/^(underline|line-through)$/],
			'text-decoration-line': [/^(underline|line-through)$/]
		}
	},
	allowedSchemes: ['http', 'https', 'mailto'],
	transformTags: {
		a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
		// execCommand('foreColor') erzeugt <font color="…"> – in ein <span> mit Farbe umwandeln.
		font: (_, attribs) => ({ tagName: 'span', attribs: attribs.color ? { style: `color: ${attribs.color}` } : {} })
	}
};

/**
 * Fast weiße oder fast schwarze Schrift kommt meist beim Einfügen aus einem Theme mit
 * (z. B. weiß aus dem Dunkelmodus) und wäre im anderen Theme unsichtbar → Farbe entfernen.
 * @param {string} color
 */
function isThemeColor(color) {
	const c = color.trim().toLowerCase();
	let rgb;
	const hex = c.match(/^#([0-9a-f]{3,8})$/);
	if (hex) {
		const h = hex[1].length <= 4 ? [...hex[1].slice(0, 3)].map((x) => x + x).join('') : hex[1].slice(0, 6);
		rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
	} else {
		const m = c.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
		if (!m) return false;
		rgb = m.slice(1, 4).map(Number);
	}
	const lightness = (Math.max(...rgb) + Math.min(...rgb)) / 2 / 255;
	return lightness > 0.85 || lightness < 0.15;
}

/** @param {string} html */
const dropThemeColors = (html) =>
	html.replace(/(^|[;"\s])color:\s*([^;"]+);?/gi, (match, before, color) => (isThemeColor(color) ? before : match));

/** HTML aus dem Editor auf die erlaubten Formatierungen reduzieren. @param {string} html */
export function cleanHtml(html) {
	const clean = sanitizeHtml(dropThemeColors(sanitizeHtml(html, OPTIONS)), OPTIONS).trim();
	// Nur leere Absätze/Zeilenumbrüche → als leer behandeln.
	const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;|\s/g, '');
	return text ? clean : '';
}
