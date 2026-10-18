// Muster-Hintergründe, selbst gezeichnet als SVG bzw. CSS-Verläufe – scharf in jeder Größe,
// nur wenige KB und ohne fremde Bildrechte. Gespeichert wird nur der Schlüssel 'p:<id>'.

/** @param {number} w @param {number} h @param {string} body */
const svg = (w, h, body) =>
	`url("data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`
	)}")`;

/** Kachel, die sich wiederholt. @param {string} bg @param {number} w @param {number} h @param {string} body */
const tile = (bg, w, h, body) => `${svg(w, h, body)} 0 0 / ${w}px ${h}px repeat, ${bg}`;

/** Ein großes Bild, das die Fläche füllt. @param {string} bg @param {number} w @param {number} h @param {string} body */
const cover = (bg, w, h, body) => `${svg(w, h, body)} center / cover no-repeat, ${bg}`;

/** @param {number} n */
const r1 = (n) => Math.round(n * 10) / 10;

// --- Bausteine ---

/** @param {number} x @param {number} y @param {number} rot */
const lemon = (x, y, rot) =>
	`<g transform='translate(${x} ${y}) rotate(${rot})'><ellipse rx='27' ry='19' fill='#f6d43c'/><ellipse cx='-27' rx='5' ry='3.5' fill='#f6d43c'/><ellipse cx='27' rx='5' ry='3.5' fill='#f6d43c'/><ellipse cx='-7' cy='-7' rx='11' ry='4' fill='#fbe892'/></g>`;

/** @param {number} x @param {number} y @param {number} rot @param {string} color @param {number} [s] */
const leaf = (x, y, rot, color, s = 1) =>
	`<g transform='translate(${x} ${y}) rotate(${rot}) scale(${s})'><path d='M0 0C8-11 23-11 32 0C23 11 8 11 0 0Z' fill='${color}'/><path d='M2 0H28' stroke='rgba(255,255,255,.35)' stroke-width='1.2'/></g>`;

/** @param {number} x @param {number} y @param {number} rot */
const melon = (x, y, rot) =>
	`<g transform='translate(${x} ${y}) rotate(${rot})'><path d='M-42 0A42 42 0 0 0 42 0Z' fill='#5bb35d'/><path d='M-36 0A36 36 0 0 0 36 0Z' fill='#eef6df'/><path d='M-32 0A32 32 0 0 0 32 0Z' fill='#f0505c'/>${[
		[-14, 10],
		[0, 16],
		[14, 10],
		[-6, 23],
		[8, 23]
	]
		.map(([cx, cy]) => `<ellipse cx='${cx}' cy='${cy}' rx='2' ry='3.5' fill='#2b2626'/>`)
		.join('')}</g>`;

/** @param {number} x @param {number} y @param {number} r */
const orangeSlice = (x, y, r) => {
	const lines = Array.from({ length: 8 }, (_, i) => {
		const a = (i * Math.PI) / 4;
		return `<path d='M${x} ${y}L${r1(x + (r - 7) * Math.cos(a))} ${r1(y + (r - 7) * Math.sin(a))}' stroke='#ffe3b5' stroke-width='2'/>`;
	}).join('');
	return `<circle cx='${x}' cy='${y}' r='${r}' fill='#f39a2b'/><circle cx='${x}' cy='${y}' r='${r - 4}' fill='#ffdca6'/><circle cx='${x}' cy='${y}' r='${r - 6}' fill='#f8b546'/>${lines}<circle cx='${x}' cy='${y}' r='3' fill='#ffe3b5'/>`;
};

/** @param {number} x @param {number} y @param {number} rot */
const cherries = (x, y, rot) =>
	`<g transform='translate(${x} ${y}) rotate(${rot})'><path d='M0 0Q5-24 18-31M25 1Q22-18 18-31' stroke='#5f8a2a' stroke-width='2.5' fill='none'/><path d='M18-31C26-38 36-36 38-30C30-27 24-27 18-31Z' fill='#6aa84f'/><circle r='10' fill='#d7263d'/><circle cx='25' cy='2' r='10' fill='#e3364c'/><ellipse cx='-3' cy='-4' rx='3' ry='2' fill='#fff' opacity='.6'/><ellipse cx='22' cy='-2' rx='3' ry='2' fill='#fff' opacity='.6'/></g>`;

/** @param {number} x @param {number} y @param {number} rot */
const strawberry = (x, y, rot) =>
	`<g transform='translate(${x} ${y}) rotate(${rot})'><path d='M0-18C16-18 22-6 18 6C14 18 4 26 0 28C-4 26-14 18-18 6C-22-6-16-18 0-18Z' fill='#e23b52'/>${[
		[-8, -6],
		[4, -8],
		[-10, 6],
		[2, 4],
		[10, 0],
		[-4, 16],
		[6, 14]
	]
		.map(([cx, cy]) => `<ellipse cx='${cx}' cy='${cy}' rx='1.4' ry='2.2' fill='#ffd76a'/>`)
		.join('')}<path d='M-13-18L-4-13L0-25L4-13L13-18L7-9L-7-9Z' fill='#3e9b4f'/></g>`;

/** @param {number} x @param {number} y @param {number} rot */
const acorn = (x, y, rot) =>
	`<g transform='translate(${x} ${y}) rotate(${rot})'><ellipse cy='6' rx='8' ry='10' fill='#b0703a'/><path d='M-10 0A10 7 0 0 1 10 0Z' fill='#6e4524'/><path d='M0-7V-11' stroke='#6e4524' stroke-width='2'/></g>`;

/** Blume mit fünf Blüten. @param {number} x @param {number} y @param {number} r @param {string} petal @param {string} center */
const flower = (x, y, r, petal, center) =>
	Array.from({ length: 5 }, (_, i) => {
		const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
		return `<circle cx='${r1(x + r * Math.cos(a))}' cy='${r1(y + r * Math.sin(a))}' r='${r1(r * 0.75)}' fill='${petal}'/>`;
	}).join('') + `<circle cx='${x}' cy='${y}' r='${r1(r * 0.55)}' fill='${center}'/>`;

/** Pusteblume. @param {number} x @param {number} y @param {number} R @param {string} c */
const dandelion = (x, y, R, c) => {
	const rays = Array.from({ length: 18 }, (_, i) => {
		const a = (i * 2 * Math.PI) / 18;
		const ex = r1(x + R * Math.cos(a));
		const ey = r1(y + R * Math.sin(a));
		return `<path d='M${x} ${y}L${ex} ${ey}' stroke='${c}' stroke-width='1.3'/><circle cx='${ex}' cy='${ey}' r='2.6' fill='${c}'/>`;
	}).join('');
	return `<path d='M${x} ${y + 6}Q${x - 10} ${y + R + 20} ${x + 4} ${y + R + 50}' stroke='#8fb8a4' stroke-width='2.5' fill='none'/>${rays}<circle cx='${x}' cy='${y}' r='${r1(R * 0.5)}' fill='none' stroke='${c}' stroke-width='1.5' stroke-dasharray='2 4'/><circle cx='${x}' cy='${y}' r='6' fill='${c}'/>`;
};

/** @param {number} x @param {number} y @param {string} c */
const tulip = (x, y, c) =>
	`<g transform='translate(${x} ${y})'><path d='M0 6V40' stroke='#5c9a5c' stroke-width='2.5'/><path d='M0 30C-12 26-16 16-14 10C-6 14-2 22 0 30Z' fill='#6aa86a'/><path d='M-11-8C-12 8-4 10 0 10C4 10 12 8 11-8L6-2L0-12L-6-2Z' fill='${c}'/></g>`;

/** Geschlossene, unregelmäßige Höhenlinien um einen Punkt. @param {number} cx @param {number} cy @param {number} seed */
const contours = (cx, cy, seed) =>
	Array.from({ length: 9 }, (_, k) => {
		const pts = Array.from({ length: 36 }, (_, i) => {
			const a = (i / 36) * 2 * Math.PI;
			const r = (k + 1) * 24 * (1 + 0.16 * Math.sin(3 * a + seed + k * 0.4) + 0.08 * Math.cos(5 * a + seed));
			return `${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`;
		});
		return `<path d='M${pts.join('L')}Z' fill='none' stroke='#424957' stroke-width='1.4'/>`;
	}).join('');

// --- Muster ---

export const PATTERNS = [
	// Früchte und Natur
	{
		id: 'lemons',
		name: 'Zitronen',
		css: tile('#fbf6e4', 180, 180, leaf(78, 26, 35, '#6aa84f') + leaf(12, 118, -60, '#7bb661') + leaf(150, 78, 120, '#6aa84f') + leaf(96, 158, -25, '#7bb661') + lemon(46, 58, -20) + lemon(132, 138, 25))
	},
	{
		id: 'watermelon',
		name: 'Wassermelonen',
		css: tile('#fdf0ee', 200, 200, melon(58, 52, -15) + melon(148, 140, 195) + `<circle cx='160' cy='40' r='4' fill='#f7b4b9'/><circle cx='40' cy='150' r='4' fill='#bfe3b4'/>`)
	},
	{
		id: 'oranges',
		name: 'Orangen',
		css: tile('#fff3e0', 180, 180, orangeSlice(50, 50, 36) + orangeSlice(135, 132, 32) + `<circle cx='140' cy='40' r='5' fill='#f8c477'/><circle cx='42' cy='140' r='5' fill='#f8c477'/>`)
	},
	{
		id: 'cherries',
		name: 'Kirschen',
		css: tile('#fff5f6', 150, 150, cherries(32, 62, -8) + cherries(98, 132, 14) + `<circle cx='120' cy='34' r='3' fill='#f6b8c0'/><circle cx='20' cy='120' r='3' fill='#f6b8c0'/>`)
	},
	{
		id: 'strawberries',
		name: 'Erdbeeren',
		css: tile('#fde7eb', 170, 170, strawberry(48, 54, -15) + strawberry(126, 124, 20) + `<circle cx='130' cy='36' r='3' fill='#f4a7b4'/><circle cx='36' cy='136' r='3' fill='#f4a7b4'/>`)
	},
	{
		id: 'autumn',
		name: 'Herbstblätter',
		css: tile('#f5ede0', 200, 200, leaf(20, 40, -20, '#d4772c', 1.4) + leaf(120, 24, 40, '#a0522d', 1.2) + leaf(150, 120, 150, '#e0a43a', 1.4) + leaf(30, 150, -70, '#c0612b', 1.2) + acorn(95, 95, 15) + acorn(175, 185, -20) + `<circle cx='70' cy='180' r='3' fill='#d9a77a'/><circle cx='175' cy='70' r='3' fill='#d9a77a'/>`)
	},

	// Blumen
	{
		id: 'flowers-light',
		name: 'Streublumen hell',
		css: tile('#fbf6ee', 160, 160, leaf(60, 30, 20, '#9cbf9a', 0.8) + leaf(118, 112, -40, '#9cbf9a', 0.8) + leaf(10, 120, 60, '#b5cfa9', 0.7) + flower(36, 40, 11, '#f08a7e', '#f7d070') + flower(116, 60, 9, '#f4b6c2', '#e46f6f') + flower(70, 118, 10, '#e8b84a', '#c0612b') + flower(140, 140, 7, '#7aa6d6', '#f7d070'))
	},
	{
		id: 'flowers-dark',
		name: 'Streublumen dunkel',
		css: tile('#1d2742', 160, 160, leaf(60, 30, 20, '#4f8f7a', 0.8) + leaf(118, 112, -40, '#4f8f7a', 0.8) + leaf(10, 120, 60, '#5aa38a', 0.7) + flower(36, 40, 11, '#f28b82', '#ffe08a') + flower(116, 60, 9, '#f7c1d0', '#e46f6f') + flower(70, 118, 10, '#f4c95d', '#d0603a') + flower(140, 140, 7, '#8ec5ff', '#ffe08a'))
	},
	{
		id: 'dandelions',
		name: 'Pusteblumen',
		css: tile('#263a63', 220, 220, dandelion(60, 50, 30, '#f3c5b6') + dandelion(165, 120, 26, '#9fd3d1') + dandelion(70, 160, 18, '#f2d16b'))
	},
	{
		id: 'tulips',
		name: 'Tulpen',
		css: tile('#f6efe6', 140, 140, tulip(35, 25, '#d9534f') + tulip(105, 95, '#e07a5f') + `<circle cx='105' cy='30' r='3' fill='#e9b9a5'/><circle cx='35' cy='105' r='3' fill='#e9b9a5'/>`)
	},

	// Abstrakt hell
	{
		id: 'waves-light',
		name: 'Wellen hell',
		css: tile('#f2f4f7', 400, 200, [25, 75, 125, 175].map((y) => `<path d='M0 ${y}C100 ${y - 16} 300 ${y + 16} 400 ${y}' stroke='#e2e6ee' stroke-width='14' fill='none'/>`).join(''))
	},
	{
		id: 'chevron',
		name: 'Zickzack',
		css: tile('#f3f4f6', 80, 40, `<polyline points='0,30 20,10 40,30 60,10 80,30' stroke='#e3e6eb' stroke-width='8' fill='none'/>`)
	},
	{
		id: 'concrete',
		name: 'Beton',
		css: tile('linear-gradient(180deg, #d3d4d0, #bdbeb9)', 300, 300, `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .3 0 0 0 0 .3 0 0 0 0 .28 .9 0 0 0 -.3'/></filter><rect width='300' height='300' filter='url(#n)'/>`)
	},
	{
		id: 'harlequin',
		name: 'Rauten',
		css: tile('#9fd8cb', 80, 120, `<path d='M40 0L80 60L40 120L0 60Z' fill='#f6c85f'/><path d='M40 0L80 60L40 120L0 60Z' fill='none' stroke='#fffaf0' stroke-width='4'/><circle cx='40' cy='60' r='3' fill='#3b3b3b' opacity='.5'/><circle cx='0' cy='0' r='3' fill='#3b3b3b' opacity='.5'/><circle cx='80' cy='0' r='3' fill='#3b3b3b' opacity='.5'/><circle cx='0' cy='120' r='3' fill='#3b3b3b' opacity='.5'/><circle cx='80' cy='120' r='3' fill='#3b3b3b' opacity='.5'/>`)
	},
	{
		id: 'pastel-shapes',
		name: 'Pastell-Formen',
		css: cover('#f3ece4', 1200, 800, `<path d='M-40 820C-60 560 80 420 300 470C480 510 520 700 470 840Z' fill='#e8c0a6'/><path d='M760-40C720 160 860 300 1040 260C1180 230 1240 120 1240-40Z' fill='#c4d6cf'/><path d='M880 840C860 640 980 560 1120 600C1220 630 1240 740 1240 840Z' fill='#e8c0a6' opacity='.7'/><path d='M120-40C160 120 360 160 460 60' stroke='#fff' stroke-width='3' fill='none'/><path d='M600 840C640 680 820 640 900 720' stroke='#fff' stroke-width='3' fill='none'/>`)
	},
	{
		id: 'dots',
		name: 'Punkte',
		css: tile('#fbf4e8', 60, 60, `<circle cx='15' cy='15' r='7' fill='#23262e'/><circle cx='45' cy='45' r='7' fill='#23262e'/>`)
	},

	// Abstrakt dunkel
	{
		id: 'lines-dark',
		name: 'Linien dunkel',
		css: cover('#0b0d12', 1200, 800, Array.from({ length: 32 }, (_, i) => `<path d='M-50 ${220 + i * 13}C300 ${40 + i * 16} 700 ${760 - i * 9} 1250 ${300 + i * 11}' stroke='rgba(255,255,255,.22)' stroke-width='1.2' fill='none'/>`).join(''))
	},
	{
		id: 'hexagons',
		name: 'Sechsecke',
		css: tile('#151729', 56, 100, `<path d='M28 66L0 50V16L28 0L56 16V50L28 66V100' fill='none' stroke='#3c3a80' stroke-width='2'/>`)
	},
	{
		id: 'blueprint',
		name: 'Raster blau',
		css: `${svg(100, 100, `<path d='M20 0V100M40 0V100M60 0V100M80 0V100M0 20H100M0 40H100M0 60H100M0 80H100' stroke='rgba(255,255,255,.1)' stroke-width='1'/><path d='M0 0H100V100' fill='none' stroke='rgba(255,255,255,.28)' stroke-width='1.5'/>`)} 0 0 / 100px 100px repeat, radial-gradient(circle at 50% 30%, #2e5ce0, #142c78)`
	},
	{
		id: 'topography',
		name: 'Höhenlinien',
		css: cover('#17191e', 1200, 800, contours(260, 220, 0) + contours(900, 560, 2) + contours(1050, 90, 4) + contours(150, 760, 1))
	},
	{
		id: 'quilted',
		name: 'Gesteppt',
		css: tile('#0f1013', 60, 60, `<path d='M30 0L60 30L30 60L0 30Z' fill='#17191d' stroke='#050506' stroke-width='2'/><path d='M4 30L30 4L56 30' fill='none' stroke='#25282e' stroke-width='1'/>`)
	},

	// Farbig
	{
		id: 'sun-rings',
		name: 'Farbkreise',
		css: 'radial-gradient(circle at 108% 55%, #ffe066 0 14%, #f7a541 22%, #f06292 34% 35%, #ee5a8e 36%, #e94e86 100%)'
	},
	{
		id: 'haze',
		name: 'Farbnebel',
		css: 'radial-gradient(ellipse at 30% 30%, #fff1d6 0 22%, transparent 55%), radial-gradient(ellipse at 80% 75%, #f26a1b 0 18%, transparent 60%), radial-gradient(ellipse at 8% 92%, #f7a74a 0 14%, transparent 50%), linear-gradient(160deg, #f9c98a, #f0802e)'
	},
	{
		id: 'violet-stripes',
		name: 'Lila mit Streifen',
		css: 'repeating-linear-gradient(135deg, rgb(255 255 255 / 12%) 0 3px, transparent 3px 18px) 0 100% / 45% 55% no-repeat, radial-gradient(circle at 70% 25%, #7a6cf5 0 10%, transparent 45%), linear-gradient(160deg, #7b3fe4, #c026d3)'
	},
	{
		id: 'bokeh',
		name: 'Lichter',
		css: [
			[18, 30, 5, 55],
			[32, 62, 3.5, 45],
			[52, 22, 4, 40],
			[68, 48, 6, 50],
			[84, 18, 3, 45],
			[76, 80, 4.5, 40],
			[40, 85, 3, 35],
			[10, 70, 4, 35]
		]
			.map(([x, y, s, a]) => `radial-gradient(circle at ${x}% ${y}%, rgb(255 205 120 / ${a}%) 0 ${s}%, transparent ${s + 1.5}%)`)
			.concat('linear-gradient(135deg, #1d3b2a, #0c1a14 60%, #3a2a10)')
			.join(', ')
	},
	{
		id: 'foil',
		name: 'Folie',
		css: `${svg(300, 300, `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.012 .03' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .35 -.05'/></filter><rect width='300' height='300' filter='url(#n)'/>`)} 0 0 / 300px 300px repeat, linear-gradient(160deg, #d98b2b, #f2b84b 30%, #3c8fc5 75%, #1f5f9a)`
	}
];

/** @param {string} id */
export const patternCss = (id) => PATTERNS.find((p) => p.id === id)?.css ?? null;
