// Menüpunkte mit Symbol – zentral, damit Menü, Schüler-Navigation und Seitentitel übereinstimmen.

/**
 * @typedef {{
 *   href: string, label: string, short?: string, icon: string, teacherOnly?: boolean,
 *   group: 'Unterricht' | 'Verwaltung', count?: 'students' | 'teachers' | 'classes'
 * }} NavItem
 */

/** @type {NavItem[]} */
export const NAV = [
	{ href: '/', label: 'Auftrag', icon: 'clipboard', group: 'Unterricht' },
	{ href: '/stundenziele', label: 'Stundenziele', icon: 'target', group: 'Unterricht' },
	{ href: '/selbstlernen', label: 'Selbstlern-Modus', short: 'Selbstlernen', icon: 'book', group: 'Unterricht' },
	{ href: '/test', label: 'Test-Modus', icon: 'test', teacherOnly: true, group: 'Unterricht' },
	{ href: '/verwaltung', label: 'Klassen', icon: 'users', teacherOnly: true, group: 'Verwaltung', count: 'classes' },
	{ href: '/verwaltung?tab=schueler', label: 'Schüler', icon: 'users', teacherOnly: true, group: 'Verwaltung', count: 'students' },
	{ href: '/verwaltung?tab=lehrer', label: 'Lehrkräfte', icon: 'briefcase', teacherOnly: true, group: 'Verwaltung', count: 'teachers' }
];

/** @param {string} href */
export const navIcon = (href) => /** @type {NavItem} */ (NAV.find((item) => item.href === href)).icon;
