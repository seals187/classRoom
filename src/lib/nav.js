// Menüpunkte mit Symbol – zentral, damit Menü, Schüler-Navigation und Seitentitel übereinstimmen.

/** @typedef {{ href: string, label: string, short?: string, icon: string, teacherOnly?: boolean }} NavItem */

/** @type {NavItem[]} */
export const NAV = [
	{ href: '/', label: 'Auftrag', icon: 'clipboard' },
	{ href: '/stundenziele', label: 'Stundenziele', icon: 'target' },
	{ href: '/selbstlernen', label: 'Selbstlern-Modus', short: 'Selbstlernen', icon: 'book' },
	{ href: '/test', label: 'Test-Modus', icon: 'test', teacherOnly: true },
	{ href: '/schueler', label: 'Schüler verwalten', icon: 'users', teacherOnly: true },
	{ href: '/lehrer', label: 'Lehrer verwalten', icon: 'briefcase', teacherOnly: true }
];

/** @param {string} href */
export const navIcon = (href) => /** @type {NavItem} */ (NAV.find((item) => item.href === href)).icon;
