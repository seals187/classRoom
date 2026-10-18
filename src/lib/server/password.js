import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

/** @param {string} password */
export function hashPassword(password) {
	const salt = randomBytes(16);
	const hash = scryptSync(password, salt, 64);
	return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * @param {string} password
 * @param {string} stored
 */
export function verifyPassword(password, stored) {
	const [scheme, salt, hash] = stored.split('$');
	if (scheme !== 'scrypt' || !salt || !hash) return false;
	const expected = Buffer.from(hash, 'base64');
	const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
	return timingSafeEqual(actual, expected);
}

// Ohne leicht verwechselbare Zeichen (i, l, o, 0, 1), damit Schüler es gut abtippen können.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generatePassword() {
	const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
	return `${block()}-${block()}`;
}
