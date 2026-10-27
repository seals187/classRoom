import qrcode from 'qrcode-generator';

// Geteilter Auftrag (QR-Code) – Helfer für Teilen-Fenster, Ecken-QR und Menü.

/**
 * Adresse der öffentlichen Seite: PUBLIC_URL aus der .env, sonst die Adresse im Browser.
 * @param {string} publicUrl
 * @param {string} code
 */
export const shareUrl = (publicUrl, code) => `${publicUrl || location.origin}/a/${code}`;

/** Zum Abtippen: ohne http:// bzw. https://. @param {string} url */
export const shortUrl = (url) => url.replace(/^https?:\/\//, '');

/**
 * QR-Code als SVG-Pfad (ein Quadrat pro dunklem Modul) samt Größe inkl. Rand.
 * @param {string} text
 */
export function qrPath(text) {
	const qr = qrcode(0, 'M');
	qr.addData(text);
	qr.make();
	const count = qr.getModuleCount();
	const quiet = 2;
	let d = '';
	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (qr.isDark(row, col)) d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
		}
	}
	return { d, size: count + quiet * 2 };
}

/**
 * Ist die Adresse von Handys aus erreichbar? 'device' = nur dieses Gerät, 'local' = nur im Schulnetz.
 * @param {string} url
 * @returns {'device' | 'local' | ''}
 */
export function reach(url) {
	let host;
	try {
		host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
	} catch {
		return '';
	}
	if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.startsWith('127.')) return 'device';
	const ip = host.split('.').map(Number);
	const isIp = ip.length === 4 && ip.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
	if (isIp && (ip[0] === 10 || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) || (ip[0] === 192 && ip[1] === 168) || (ip[0] === 169 && ip[1] === 254))) {
		return 'local';
	}
	// Name ohne Punkt (z. B. „beamer-pc“) oder .local/.lan/.home/.internal: nur im eigenen Netz bekannt.
	if (!isIp && (!host.includes('.') || /\.(local|lan|home|internal|intranet)$/.test(host))) return 'local';
	if (host.includes(':') && /^(fc|fd|fe80)/.test(host)) return 'local';
	return '';
}

/** Gültigkeit zur Auswahl (Tage); der Standard aus der .env kommt dazu. @param {number} standard */
export const dayChoices = (standard) => [...new Set([1, 7, 30, standard])].sort((a, b) => a - b);

/** @param {number} days */
export const daysLabel = (days) => (days === 1 ? '1 Tag' : `${days} Tage`);

/** „Mo 03.11., 14:20“ @param {number} ms */
export function formatExpiry(ms) {
	const d = new Date(ms);
	const day = d.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' });
	const time = d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
	return `${day.replace(',', '')}, ${time}`;
}
