// Runde Avatare mit Initialen – Farbe fest je Person (nach ID), damit sie überall gleich aussieht.

const COLORS = ['#3b6fe0', '#f08a3c', '#8b5cd6', '#2f9e64', '#e0484a', '#1f9bb0'];

/** „Anna Muster“ → „AM“, „admin-classroom“ → „AC“. @param {string} name */
export function initials(name) {
	return name
		.split(/[\s._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0].toUpperCase())
		.join('');
}

/** @param {number} id */
export const avatarColor = (id) => COLORS[Math.abs(id) % COLORS.length];
