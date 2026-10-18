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

/** HTML aus dem Editor auf die erlaubten Formatierungen reduzieren. @param {string} html */
export function cleanHtml(html) {
	const clean = sanitizeHtml(html, OPTIONS).trim();
	// Nur leere Absätze/Zeilenumbrüche → als leer behandeln.
	const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;|\s/g, '');
	return text ? clean : '';
}
