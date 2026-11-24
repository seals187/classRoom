import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { decorateAssignment, nextLevel, showStepProgress } from './assignment-display.js';

/** @param {string} html */
function render(html, storage = memoryStorage()) {
	const { document } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
	const root = /** @type {Element} */ (document.getElementById('root'));
	decorateAssignment(root, { checkScope: '1|Test', storage });
	return { root, storage, document };
}

function memoryStorage() {
	/** @type {Map<string, string>} */
	const map = new Map();
	return { getItem: (/** @type {string} */ k) => map.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => void map.set(k, v) };
}

describe('decorateAssignment', () => {
	it('kürzt Links, deren Text die Adresse ist', () => {
		const { root } = render('<p>Siehe <a href="https://www.example.org/">https://www.example.org/</a> und <a href="https://x.ch">hier</a></p><p>Ende</p>');
		expect([...root.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['example.org', 'hier']);
	});

	it('sammelt Absätze mit nur Links am Ende', () => {
		const { root } = render('<p>Text</p><p><a href="https://a.ch">a</a></p><p></p><p><a href="https://b.ch">b</a></p>');
		const last = /** @type {Element} */ (root.lastElementChild);
		expect(last.className).toBe('links');
		expect(last.querySelectorAll('a')).toHaveLength(2);
	});

	it('Zusatzzeile nach dem Zeilenumbruch eines Schritts, nur bis zur Unterliste', () => {
		const { root } = render('<ol><li data-step="a">Lesen<br>leise<ul><li>x</li></ul></li></ol>');
		expect(root.querySelector('.sub')?.textContent).toBe('leise');
		expect(root.querySelector('li[data-step] > ul')).not.toBeNull();
	});

	it('Video-Baustein wird zum YouTube-Player, ungültige IDs nicht', () => {
		const { root } = render('<div class="video" data-yt="dQw4w9WgXcQ">youtu.be/dQw4w9WgXcQ</div><div class="video" data-yt="nein">youtu.be/nein</div><p>Ende</p>');
		const frames = root.querySelectorAll('iframe');
		expect(frames).toHaveLength(1);
		expect(frames[0].getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
	});

	it('Checkliste: Abhaken bleibt gemerkt', () => {
		const html = '<ul class="check"><li>eins</li><li>zwei</li></ul>';
		const first = render(html);
		const li = /** @type {Element} */ (first.root.querySelector('ul.check > li'));
		li.dispatchEvent(new first.document.defaultView.Event('click'));
		expect(li.classList.contains('done')).toBe(true);
		const again = render(html, first.storage);
		expect([...again.root.querySelectorAll('ul.check > li')].map((x) => x.classList.contains('done'))).toEqual([true, false]);
	});
});

describe('showStepProgress', () => {
	it('Badge pro Schritt nach Schlüssel, „alle“ wenn fertig, weg ohne Ziele', () => {
		const { root } = render('<ol><li data-step="a">eins</li><li data-step="b">zwei</li></ol>');
		showStepProgress(root, { a: { done: 3, total: 3 }, b: { done: 1, total: 4 } });
		const badges = [...root.querySelectorAll('.step-count')];
		expect(badges.map((b) => b.textContent)).toEqual(['✓ 3/3', '✓ 1/4']);
		expect(badges[0].classList.contains('all')).toBe(true);
		showStepProgress(root, { b: { done: 2, total: 4 } });
		expect([...root.querySelectorAll('.step-count')].map((b) => b.textContent)).toEqual(['✓ 2/4']);
	});
});

describe('nextLevel', () => {
	const levels = [1, 2, 3];
	it.each([
		[2, 1, 3],
		[2, -1, 1],
		[3, 1, 3],
		[1, -1, 1],
		[1.5, 1, 2],
		[1.5, -1, 1]
	])('von %s in Richtung %s → %s', (current, dir, expected) => {
		expect(nextLevel(levels, current, dir)).toBe(expected);
	});
});
