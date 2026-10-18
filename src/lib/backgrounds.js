// Hintergründe für Auftrag, Stundenziele und Selbstlernen. Gespeichert wird nur der Schlüssel:
// '' = kein Hintergrund, 'g:<id>' = Farbverlauf aus dieser Liste, 'p:<id>' = Muster (patterns.js), 'f:<id>' = Foto,
// 'i:<id>' = hochgeladenes Bild.

export const GRADIENTS = /** @type {const} */ ([
	{ id: 'lime', css: 'linear-gradient(180deg, #a8c63a 0%, #8bb42c 100%)' },
	{ id: 'ocean', css: 'linear-gradient(180deg, #22c1d9 0%, #0f5d83 55%, #0b3557 100%)' },
	{ id: 'wine', css: 'linear-gradient(180deg, #2b0d0a 0%, #8a1a12 100%)' },
	{ id: 'olive', css: 'linear-gradient(180deg, #6b7a1f 0%, #4a5a19 100%)' },
	{ id: 'blush', css: 'linear-gradient(180deg, #c76a7e 0%, #f7a49a 100%)' },
	{ id: 'berry', css: 'linear-gradient(135deg, #6e2a43 0%, #b04a5f 100%)' },
	{ id: 'sun', css: 'linear-gradient(135deg, #f7e43f 0%, #f99d2a 100%)' },
	{ id: 'ember', css: 'linear-gradient(135deg, #f45b1e 0%, #6b1a05 100%)' },
	{ id: 'sky', css: 'linear-gradient(135deg, #2a5f9e 0%, #49b4e8 100%)' },
	{ id: 'forest', css: 'linear-gradient(135deg, #12a95a 0%, #0a6b2f 100%)' },
	{ id: 'night', css: 'radial-gradient(circle at 50% 40%, #2d4a85 0%, #1a2a52 70%)' },
	{ id: 'coral', css: 'linear-gradient(180deg, #e0565e 0%, #d4575c 100%)' },
	{ id: 'tangerine', css: 'linear-gradient(180deg, #ff7f50 0%, #f86d44 100%)' },
	{ id: 'pine', css: 'linear-gradient(135deg, #1f4d45 0%, #234b4d 100%)' },
	{ id: 'teal', css: 'linear-gradient(135deg, #12707b 0%, #22a4a8 100%)' },
	{ id: 'peach', css: 'linear-gradient(135deg, #f0b98a 0%, #c06a5a 55%, #6b2a3f 100%)' },
	{ id: 'slate', css: 'linear-gradient(135deg, #3d4a55 0%, #1d2128 100%)' },
	{ id: 'rainbow', css: 'linear-gradient(90deg, #2fc4f2 0%, #c86dd7 50%, #f45d6b 100%)' },
	{ id: 'plum', css: 'linear-gradient(135deg, #8c1a7a 0%, #2e1530 100%)' },
	{ id: 'lavender', css: 'linear-gradient(135deg, #3a1d5c 0%, #7a5d96 100%)' },
	{ id: 'dusk', css: 'linear-gradient(180deg, #5f7392 0%, #1b2a4a 100%)' },
	{ id: 'deep', css: 'linear-gradient(180deg, #1a6f8f 0%, #0d3a5c 100%)' },
	{ id: 'candy', css: 'linear-gradient(135deg, #f3b33b 0%, #e4567a 35%, #8d5ad9 65%, #2fc4b2 100%)' },
	{ id: 'meadow', css: 'linear-gradient(180deg, #158a8a 0%, #7cc46a 100%)' },
	{ id: 'rose', css: 'linear-gradient(135deg, #f0336b 0%, #6b0f2e 100%)' }
]);

/** @param {string} id */
export const gradientCss = (id) => GRADIENTS.find((g) => g.id === id)?.css ?? null;

// Fotos von Pexels (freie Pexels-Lizenz), in static/backgrounds – höchstens 1920 px breit,
// dazu kleine Vorschaubilder in thumbs/. Gespeichert wird 'f:<id>'.
export const PHOTOS = /** @type {const} */ ([
	{ id: 'fern', name: 'Farn', color: '#0b1408', credit: 'Dominykas (Pexels)' },
	{ id: 'flowers-dark', name: 'Blüten auf Dunkel', color: '#1b1c1a', credit: 'Evie Shaffer (Pexels)' },
	{ id: 'city-night', name: 'Stadt am Abend', color: '#26221f', credit: 'Peter Olexa (Pexels)' },
	{ id: 'bokeh', name: 'Lichter warm', color: '#3a1418', credit: 'shotbyrain (Pexels)' },
	{ id: 'ribbon', name: 'Band lila', color: '#aea4de', credit: 'Steve (Pexels)' },
	{ id: 'daisies', name: 'Margeriten', color: '#8a6184', credit: 'Alexas Fotos (Pexels)' },
	{ id: 'dusk-gradient', name: 'Abendverlauf', color: '#53203b', credit: 'Codioful (Pexels)' },
	{ id: 'evening-sky', name: 'Abendhimmel', color: '#8f627c', credit: 'David Si (Pexels)' },
	{ id: 'hearts', name: 'Herzen', color: '#df6974', credit: 'DS stories (Pexels)' },
	{ id: 'sunset-coast', name: 'Sonnenuntergang', color: '#814c3d', credit: 'Ian Panelo (Pexels)' },
	{ id: 'glow-red', name: 'Glut rot', color: '#4e202f', credit: 'Marcin Jozwiak (Pexels)' },
	{ id: 'glow-violet', name: 'Glut lila', color: '#4e2b4c', credit: 'Marcin Jozwiak (Pexels)' },
	{ id: 'desert', name: 'Wüste', color: '#9b9e9f', credit: 'Pixabay (Pexels)' },
	{ id: 'folds-pink', name: 'Faltwerk rosa', color: '#a36a7b', credit: 'Steve (Pexels)' },
	{ id: 'cubes-red', name: 'Würfel', color: '#4f4049', credit: 'Steve (Pexels)' },
	{ id: 'color-blots', name: 'Farbflecken', color: '#8b5f68', credit: 'Steve (Pexels)' },
	{ id: 'be-brilliant', name: 'Be Brilliant', color: '#b86a60', credit: 'Timothy Paule II (Pexels)' },
	{ id: 'grasses', name: 'Gräser im Abendlicht', color: '#92716b', credit: 'Vlah (Pexels)' }
]);

/** @param {string} id @param {boolean} [thumb] */
export const photoUrl = (id, thumb = false) => `/backgrounds/${thumb ? 'thumbs/' : ''}${id}.jpg`;

/** @param {string} id */
export function photoCss(id) {
	const photo = PHOTOS.find((p) => p.id === id);
	return photo ? `center / cover no-repeat url("${photoUrl(photo.id)}"), ${photo.color}` : null;
}
