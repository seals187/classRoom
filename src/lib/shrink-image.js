// Bilder vor dem Hochladen im Browser verkleinern: höchstens MAX_SIDE Pixel an der längeren Seite
// und ungefähr TARGET_BYTES groß (JPEG). Kleine Bilder und GIFs (Animation) bleiben unverändert.

const MAX_SIDE = 1920;
const TARGET_BYTES = 400 * 1024;
const QUALITIES = [0.85, 0.75, 0.65, 0.55];

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} quality
 * @returns {Promise<Blob | null>}
 */
const toJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

/**
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function shrinkImage(file) {
	if (file.type === 'image/gif') return file;

	let bitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		// Kann der Browser nicht lesen – unverändert senden, der Server prüft das Format.
		return file;
	}

	const longest = Math.max(bitmap.width, bitmap.height);
	if (file.size <= TARGET_BYTES && longest <= MAX_SIDE) {
		bitmap.close();
		return file;
	}

	let scale = Math.min(1, MAX_SIDE / longest);
	/** @type {Blob | null} */
	let best = null;
	// Erst die Qualität senken, dann notfalls weiter verkleinern.
	for (let round = 0; round < 4; round++) {
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
		// JPEG kennt keine Transparenz – weißer statt schwarzer Hintergrund.
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		for (const quality of QUALITIES) {
			const blob = await toJpeg(canvas, quality);
			if (!blob) continue;
			if (!best || blob.size < best.size) best = blob;
			if (blob.size <= TARGET_BYTES) break;
		}
		if (best && best.size <= TARGET_BYTES) break;
		scale *= 0.75;
	}
	bitmap.close();

	if (!best || best.size >= file.size) return file;
	const name = file.name.replace(/\.[^.]*$/, '') + '.jpg';
	return new File([best], name, { type: 'image/jpeg' });
}
