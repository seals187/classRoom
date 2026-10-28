<script>
	import { onMount, tick } from 'svelte';
	import { ui } from '#lib/ui.svelte.js';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { ask, askText, showError } from '#lib/dialog.svelte.js';
	import { shrinkImage } from '#lib/shrink-image.js';
	import { dashesToSteps } from '#lib/steps.js';
	import Icon from './Icon.svelte';
	import GoalsFromAssignment from './GoalsFromAssignment.svelte';
	import AssignmentTransfer from './AssignmentTransfer.svelte';
	import ShareAssignment from './ShareAssignment.svelte';
	import { page } from '$app/state';
	import { qrPath, shareUrl } from '#lib/share.js';

	/**
	 * @type {{
	 *   assignment: import('#lib/server/assignment.js').Assignment,
	 *   canEdit: boolean,
	 *   students?: { id: number, firstName: string, lastName: string }[],
	 *   groups?: import('#lib/server/groups.js').Group[],
	 *   progress?: Record<string, { done: number, total: number }>,
	 *   owners?: { id: number, username: string, title: string, hasAssignment: boolean }[],
	 *   share?: import('#lib/server/share.js').Share | null,
	 *   fileBase?: string,
	 *   plain?: boolean
	 * }}
	 */
	let { assignment, canEdit, students = [], groups = [], progress = {}, owners = [], share = null, fileBase = '/api/files/', plain = false } = $props();
	// plain: geteilte Seite ohne Anmeldung – keine Knöpfe, auf dem Handy ohne Kartenrahmen und Bilder unter dem Text.

	// Teilen per QR-Code; der kleine QR-Code in der Ecke gilt pro Gerät (z. B. am Beamer).
	let shareOpen = $state(false);
	const CORNER_KEY = 'shareCorner';
	let corner = $state(false);
	const cornerQr = $derived(share && corner && !editing ? qrPath(shareUrl(page.data.sharing?.publicUrl ?? '', share.code)) : null);

	function openShare() {
		// Das Fenster liegt außerhalb der Karte – im Vollbild wäre es nicht zu sehen.
		if (document.fullscreenElement) document.exitFullscreen();
		shareOpen = true;
	}

	// Fenster „Ziele aus dem Auftrag“
	let goalsOpen = $state(false);
	// „Weitergeben“ an eine andere Lehrkraft (nur wenn es mehrere gibt)
	let transferOpen = $state(false);

	// Kein Schwarz: Normaler Text passt sich dem Theme an, festes Schwarz wäre im Dunkelmodus unlesbar.
	const COLORS = [
		{ name: 'Rot', value: '#d63c3c' },
		{ name: 'Blau', value: '#3767d6' },
		{ name: 'Grün', value: '#23905a' },
		{ name: 'Orange', value: '#e08a00' },
		{ name: 'Lila', value: '#8b44c9' }
	];

	let editing = $state(false);
	let title = $state('');
	/** @type {number[]} */
	let images = $state([]);
	let saving = $state(false);
	let uploading = $state(0);
	let error = $state('');
	/** @type {HTMLDivElement | undefined} */
	let editorEl = $state();
	/** @type {HTMLInputElement | undefined} */
	let fileInput = $state();
	let active = $state({ bold: false, italic: false, underline: false, ul: false, ol: false });

	/** @type {string | null} */
	let zoomed = $state(null);

	// Schriftgröße (A− / A+) und Bildgröße pro Gerät, z. B. größer am Beamer.
	const SCALE_KEY = 'assignmentScale';
	const SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2, 2.25, 2.5];
	let scale = $state(1);
	const IMAGE_SIZE_KEY = 'assignmentImageWidth';
	// Breite der Bildspalte in % der Karte: 15 % bis 50 % in feinen Schritten
	const IMAGE_SIZES = Array.from({ length: 15 }, (_, i) => 15 + i * 2.5);
	let imageSize = $state(30);
	// Smartphone (Bilder über dem Text): Breite einer Vorschau in % – 15 → 13.5 %, 30 → 27 %, 50 → ganze Breite.
	const thumbWidth = $derived(imageSize <= 30 ? imageSize * 0.9 : 27 + (imageSize - 30) * 3.65);
	// Geteilte Seite auf dem Handy: eigene, gut sichtbare Stufen – ganze Breite (Standard), ¾, ½, ⅓.
	const PHONE_IMAGE_KEY = 'sharedPhoneImageWidth';
	const PHONE_SIZES = [33, 50, 75, 100];
	let phoneSize = $state(100);
	let phone = $state(false);
	const phoneSteps = $derived(plain && phone);
	const sizeLevels = $derived(phoneSteps ? PHONE_SIZES : IMAGE_SIZES);
	const sizeNow = $derived(phoneSteps ? phoneSize : imageSize);
	/** @type {HTMLElement | undefined} */
	let sectionEl = $state();
	let fullscreen = $state(false);
	// Geteilte Seite ohne Menü: Hell/Dunkel als Knopf ganz rechts (gleicher Speicher wie im Menü).
	/** @type {'light' | 'dark'} */
	let theme = $state('light');
	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', theme);
		try {
			localStorage.setItem('theme', theme);
		} catch {
			// Gilt dann nur bis zum Neuladen.
		}
	}
	// Erst im Browser (DOMParser) – sonst passt das Server-HTML nicht zum Client.
	let mounted = $state(false);

	onMount(() => {
		mounted = true;
		theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
		try {
			const stored = Number(localStorage.getItem(SCALE_KEY));
			if (stored >= SCALES[0] && stored <= SCALES[SCALES.length - 1]) scale = stored;
			const storedImage = Number(localStorage.getItem(IMAGE_SIZE_KEY));
			if (IMAGE_SIZES.includes(storedImage)) imageSize = storedImage;
			corner = localStorage.getItem(CORNER_KEY) === '1';
			const storedPhone = Number(localStorage.getItem(PHONE_IMAGE_KEY));
			if (PHONE_SIZES.includes(storedPhone)) phoneSize = storedPhone;
		} catch {
			// Kein localStorage – Standardgröße.
		}
		// Wie im CSS: bis 760 px stehen die Bilder über bzw. unter dem Text.
		const narrow = window.matchMedia('(max-width: 760px)');
		const onNarrow = () => (phone = narrow.matches);
		onNarrow();
		narrow.addEventListener('change', onNarrow);
		const onChange = () => (fullscreen = document.fullscreenElement === sectionEl);
		document.addEventListener('fullscreenchange', onChange);
		return () => {
			document.removeEventListener('fullscreenchange', onChange);
			narrow.removeEventListener('change', onNarrow);
		};
	});

	/**
	 * Eine Stufe größer (+1) oder kleiner (−1); Zwischenwerte (alte Einstellung) springen zur nächsten Stufe.
	 * @param {number[]} levels
	 * @param {number} current
	 * @param {number} dir
	 */
	function nextLevel(levels, current, dir) {
		const i = levels.findIndex((v) => v >= current);
		const at = i === -1 ? levels.length - 1 : i;
		const target = levels[at] > current && dir > 0 ? at : at + dir;
		return levels[Math.min(levels.length - 1, Math.max(0, target))];
	}

	/** @param {string} key @param {number} value */
	function remember(key, value) {
		try {
			localStorage.setItem(key, String(value));
		} catch {
			// Gilt dann nur bis zum Neuladen.
		}
	}

	/** @param {number} dir */
	function changeScale(dir) {
		scale = nextLevel(SCALES, scale, dir);
		remember(SCALE_KEY, scale);
	}

	/** @param {number} dir */
	function changeImageSize(dir) {
		if (phoneSteps) {
			phoneSize = nextLevel(PHONE_SIZES, phoneSize, dir);
			remember(PHONE_IMAGE_KEY, phoneSize);
			return;
		}
		imageSize = nextLevel(IMAGE_SIZES, imageSize, dir);
		remember(IMAGE_SIZE_KEY, imageSize);
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) document.exitFullscreen();
		else sectionEl?.requestFullscreen().catch(() => {});
	}

	/** Haupttext der Schritte (ohne graue Zusatzzeile) – Grundlage für „Als Stundenziele“. */
	const stepTexts = $derived.by(() => {
		if (!mounted || !assignment.html) return [];
		const doc = new DOMParser().parseFromString(assignment.html, 'text/html');
		dashesToSteps(doc.body);
		return [...doc.querySelectorAll('body > ol > li')]
			.map((li) => {
				const br = [...li.childNodes].find((n) => n.nodeName === 'BR');
				while (br?.nextSibling) br.nextSibling.remove();
				return (li.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
			})
			.filter(Boolean);
	});

	// Letzte Auswahl im Editor merken – Farbwähler und Link-Dialog nehmen sonst den Fokus mit.
	/** @type {Range | null} */
	let lastRange = null;

	// Beim Bearbeiten Platz schaffen: Startseite blendet die Stundenziel-Leiste aus.
	$effect(() => {
		ui.focus = editing;
		return () => {
			ui.focus = false;
		};
	});

	const isEmpty = $derived(!assignment.title && !assignment.html && assignment.images.length === 0);
	const shownImages = $derived(editing ? images : assignment.images);

	/** @param {number} id */
	const fileUrl = (id) => `${fileBase}${id}`;

	async function startEdit() {
		title = assignment.title;
		images = [...assignment.images];
		error = '';
		lastRange = null;
		editing = true;
		await tick();
		if (editorEl) editorEl.innerHTML = assignment.html;
		window.scrollTo({ top: 0 });
	}

	async function save() {
		saving = true;
		error = '';
		try {
			await api('/api/assignment', 'PUT', { title, html: editorEl?.innerHTML ?? '', images });
			await invalidateAll();
			editing = false;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	async function remove() {
		const ok = await ask({
			title: 'Auftrag löschen?',
			message: 'Titel, Text und Bilder werden entfernt.',
			confirmLabel: 'Löschen',
			danger: true
		});
		if (!ok) return;
		try {
			await api('/api/assignment', 'DELETE');
			editing = false;
		} catch (err) {
			showError(err);
		}
		await invalidateAll();
	}

	// --- Formatierung ---

	function onSelectionChange() {
		const sel = document.getSelection();
		if (!editing || !sel?.rangeCount || !editorEl?.contains(sel.anchorNode)) return;
		lastRange = sel.getRangeAt(0).cloneRange();
		/** @param {string} command */
		const state = (command) => {
			try {
				return document.queryCommandState(command);
			} catch {
				return false;
			}
		};
		active = {
			bold: state('bold'),
			italic: state('italic'),
			underline: state('underline'),
			ul: state('insertUnorderedList'),
			ol: state('insertOrderedList')
		};
	}

	function restoreSelection() {
		editorEl?.focus();
		if (!lastRange) return;
		const sel = document.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(lastRange);
	}

	/**
	 * execCommand ist zwar als veraltet markiert, wird aber von allen Browsern unterstützt
	 * und hält den Editor ohne zusätzliche Bibliothek klein.
	 * @param {string} command
	 * @param {string} [value]
	 */
	function exec(command, value) {
		restoreSelection();
		document.execCommand(command, false, value);
		onSelectionChange();
	}

	/** Buttons der Leiste sollen dem Editor den Fokus (und damit die Auswahl) nicht wegnehmen. @param {MouseEvent} e */
	function keepFocus(e) {
		if (/** @type {HTMLElement} */ (e.target).closest('button')) e.preventDefault();
	}

	async function addLink() {
		const url = (
			await askText({ title: 'Link einfügen', message: 'Adresse des Links:', placeholder: 'https://…', confirmLabel: 'Einfügen' })
		)?.trim();
		if (!url) return;
		if (!/^(https?:\/\/|mailto:)/i.test(url)) {
			error = 'Links müssen mit https:// (oder http://) beginnen.';
			return;
		}
		restoreSelection();
		const sel = document.getSelection();
		if (sel && !sel.isCollapsed) {
			exec('createLink', url);
		} else {
			const a = document.createElement('a');
			a.href = url;
			a.textContent = url;
			exec('insertHTML', a.outerHTML + '&nbsp;');
		}
	}

	// --- Bilder ---

	/** @param {File[]} files */
	async function upload(files) {
		for (const file of files.filter((f) => f.type.startsWith('image/'))) {
			uploading++;
			error = '';
			try {
				const form = new FormData();
				// Erst im Browser verkleinern (einige hundert KB), dann hochladen.
				form.append('file', await shrinkImage(file));
				const { id } = await api('/api/files', 'POST', form);
				images = [...images, id];
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
			} finally {
				uploading--;
			}
		}
	}

	/** Bilder hochladen, Text nur als reinen Text einfügen (keine Fremdformatierung aus Word & Co.). @param {ClipboardEvent} e */
	function onPaste(e) {
		const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
		e.preventDefault();
		if (files.length) {
			upload(files);
			return;
		}
		const text = e.clipboardData?.getData('text/plain');
		if (text) document.execCommand('insertText', false, text);
	}

	// Beim Bearbeiten ist die ganze Karte Ablagefläche für Bilder (nicht nur das Textfeld).
	let dragOver = $state(false);
	let dragDepth = 0;

	/** Werden Dateien gezogen? (Text innerhalb des Editors verschieben bleibt normal.) @param {DragEvent} e */
	const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');

	/** @param {DragEvent} e */
	function onDragEnter(e) {
		if (!editing || !hasFiles(e)) return;
		dragDepth++;
		dragOver = true;
	}

	/** @param {DragEvent} e */
	function onDragLeave(e) {
		if (!editing || !hasFiles(e)) return;
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) dragOver = false;
	}

	/** @param {DragEvent} e */
	function onDragOver(e) {
		if (!editing || !hasFiles(e)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}

	/** @param {DragEvent} e */
	function onDrop(e) {
		dragDepth = 0;
		dragOver = false;
		if (!editing || !hasFiles(e)) return;
		// Auch bei Nicht-Bildern: sonst öffnet der Browser die Datei und die Änderungen sind weg.
		e.preventDefault();
		upload([...(e.dataTransfer?.files ?? [])]);
	}

	/**
	 * Schritte der nummerierten Liste (auch von Hand mit „- “ getippt): Text nach dem ersten
	 * Zeilenumbruch (Umschalt+Enter) als graue Zusatzzeile anzeigen. Nur fürs Anzeigen –
	 * gespeichert bleibt das HTML unverändert.
	 * @param {HTMLElement} node
	 */
	function steps(node) {
		function apply() {
			dashesToSteps(node);
			// Links: nur die Adresse ohne https:// und www. zeigen, wenn der Text die Adresse selbst ist.
			for (const a of node.querySelectorAll('a')) {
				const href = a.getAttribute('href') ?? '';
				if (a.textContent?.trim() !== href) continue;
				a.textContent = href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
			}
			// Absätze am Ende, die nur Links enthalten, unten in der Karte sammeln.
			if (!node.querySelector(':scope > .links')) {
				/** @param {Element} el */
				const onlyLinks = (el) =>
					el.querySelector('a') !== null &&
					[...el.childNodes].every((n) => n.nodeName === 'A' || n.nodeName === 'BR' || !n.textContent?.trim());
				/** @param {Element} el */
				const blank = (el) => !el.textContent?.trim() && !el.querySelector('img');
				const tail = [];
				let el = node.lastElementChild;
				while (el && (onlyLinks(el) || blank(el))) {
					const prev = el.previousElementSibling;
					if (onlyLinks(el)) tail.unshift(el);
					else el.remove();
					el = prev;
				}
				if (tail.length) {
					const links = document.createElement('div');
					links.className = 'links';
					links.append(...tail);
					node.append(links);
				}
			}
			for (const li of node.querySelectorAll(':scope > ol > li')) {
				if (li.querySelector(':scope > .sub')) continue;
				const br = [...li.childNodes].find((n) => n.nodeName === 'BR');
				if (!br?.nextSibling) continue;
				const sub = document.createElement('span');
				sub.className = 'sub';
				while (br.nextSibling) sub.appendChild(br.nextSibling);
				br.replaceWith(sub);
			}
		}
		apply();
	}

	/**
	 * An jedem Schritt: wie viele Schüler ihn als Ziel erledigt haben (z. B. „7/11“).
	 * Läuft nach `steps` und aktualisiert sich mit jedem Neuladen der Daten.
	 * @param {HTMLElement} node
	 * @param {Record<string, { done: number, total: number }>} stats
	 */
	function stepProgress(node, stats) {
		/** @param {Record<string, { done: number, total: number }>} current */
		function apply(current) {
			for (const li of node.querySelectorAll(':scope > ol > li')) {
				const clone = /** @type {HTMLElement} */ (li.cloneNode(true));
				clone.querySelectorAll('.sub, .step-count').forEach((el) => el.remove());
				const key = (clone.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
				const entry = current[key];
				let badge = li.querySelector(':scope > .step-count');
				if (!entry || entry.total === 0) {
					badge?.remove();
					continue;
				}
				if (!badge) {
					badge = document.createElement('span');
					badge.className = 'step-count';
					li.append(badge);
				}
				badge.classList.toggle('all', entry.done === entry.total);
				badge.textContent = `✓ ${entry.done}/${entry.total}`;
				badge.setAttribute('title', `${entry.done} von ${entry.total} Schülern erledigt`);
			}
		}
		apply(stats);
		return { update: apply };
	}
</script>

<svelte:document onselectionchange={onSelectionChange} />
<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		zoomed = null;
	}}
/>

<section
	class="assignment"
	role="region"
	aria-label="Auftrag"
	class:editing
	class:fullscreen
	class:plain
	class:drag-over={dragOver}
	class:with-images={editing || shownImages.length > 0}
	ondragenter={onDragEnter}
	ondragleave={onDragLeave}
	ondragover={onDragOver}
	ondrop={onDrop}
	style:--scale={editing || plain ? null : scale}
	style:--user-scale={plain ? scale : null}
	style:--image-col={editing ? null : `${imageSize}%`}
	style:--thumb={editing ? null : `${plain ? phoneSize : thumbWidth}%`}
	bind:this={sectionEl}
>
	<!-- Über die ganze Breite: Knöpfe bleiben fix, auch wenn die Bilder größer werden. -->
	<header>
		<span class="label">{editing ? 'Auftrag bearbeiten' : 'Auftrag'}</span>
		{#if !editing}
			<div class="tools">
				{#if canEdit && stepTexts.length > 0}
					<button class="tool accent" onclick={() => (goalsOpen = true)} title="Die Schritte als Ziele an die Schüler senden">
						☑ Als Stundenziele
					</button>
				{/if}
				{#if !isEmpty}
					<button class="tool" onclick={() => changeScale(-1)} disabled={scale <= SCALES[0]} title="Schrift kleiner">A−</button>
					<button class="tool" onclick={() => changeScale(1)} disabled={scale >= SCALES[SCALES.length - 1]} title="Schrift größer">
						A+
					</button>
				{/if}
				{#if canEdit && !isEmpty}
					<button
						class="tool"
						class:on={!!share}
						onclick={openShare}
						title={share ? 'QR-Code zeigen' : 'Per QR-Code teilen'}
						aria-label={share ? 'QR-Code zeigen' : 'Per QR-Code teilen'}
					>
						<Icon name="qr" size={13} />
					</button>
				{/if}
				{#if shownImages.length > 0}
					<button
						class="tool img-size"
						onclick={() => changeImageSize(-1)}
						disabled={sizeNow <= sizeLevels[0]}
						title="Bilder kleiner"
						aria-label="Bilder kleiner"
					>
						<Icon name="image" size={13} />−
					</button>
					<button
						class="tool img-size"
						onclick={() => changeImageSize(1)}
						disabled={sizeNow >= sizeLevels[sizeLevels.length - 1]}
						title="Bilder größer"
						aria-label="Bilder größer"
					>
						<Icon name="image" size={13} />+
					</button>
				{/if}
				{#if canEdit && owners.length > 1}
					<button
						class="tool with-icon"
						onclick={() => (transferOpen = true)}
						title="An eine andere Lehrkraft kopieren oder übertragen"
						aria-label="Auftrag weitergeben"
					>
						<Icon name="users" size={13} /> Weitergeben
					</button>
				{/if}
				{#if canEdit}
					<button class="tool" onclick={startEdit} title="Bearbeiten" aria-label="Bearbeiten"><Icon name="pencil" size={13} /></button>
				{/if}
				{#if !isEmpty}
					<button class="tool" onclick={toggleFullscreen} title={fullscreen ? 'Vollbild beenden' : 'Vollbild'} aria-label="Vollbild">
						<Icon name={fullscreen ? 'close' : 'expand'} size={13} />
					</button>
				{/if}
				{#if plain}
					<button
						class="tool theme"
						onclick={toggleTheme}
						title={theme === 'dark' ? 'Hell' : 'Dunkel'}
						aria-label={theme === 'dark' ? 'Hell darstellen' : 'Dunkel darstellen'}
					>
						<Icon name={theme === 'dark' ? 'sun' : 'moon'} size={13} />
					</button>
				{/if}
			</div>
		{:else if editing}
			<!-- Oben statt unter dem Editor – so muss man zum Speichern nicht scrollen. -->
			<div class="head-actions">
				{#if !isEmpty}<button class="text-btn danger" onclick={remove} disabled={saving}>Auftrag löschen</button>{/if}
				<button onclick={() => (editing = false)} disabled={saving}>Abbrechen</button>
				<button class="primary" onclick={save} disabled={saving || uploading > 0}>
					{uploading > 0 ? 'Bild lädt…' : 'Speichern'}
				</button>
			</div>
		{/if}
	</header>
	<div class="main">
		{#if editing && error}<p class="error">{error}</p>{/if}

		{#if editing}
			<input type="text" class="title-input" bind:value={title} placeholder="Titel, z. B. Geschichte – Das Römische Reich" maxlength="120" />

			<div class="toolbar" role="toolbar" aria-label="Formatierung" tabindex="-1" onmousedown={keepFocus}>
				<button class:on={active.bold} aria-pressed={active.bold} title="Fett (Strg+B)" onclick={() => exec('bold')}>
					<strong>B</strong>
				</button>
				<button class:on={active.italic} aria-pressed={active.italic} title="Kursiv (Strg+I)" onclick={() => exec('italic')}>
					<em>I</em>
				</button>
				<button
					class:on={active.underline}
					aria-pressed={active.underline}
					title="Unterstrichen (Strg+U)"
					onclick={() => exec('underline')}
				>
					<u>U</u>
				</button>
				<span class="sep"></span>
				<button class:on={active.ul} aria-pressed={active.ul} title="Aufzählung" onclick={() => exec('insertUnorderedList')}>
					• Liste
				</button>
				<button
					class:on={active.ol}
					aria-pressed={active.ol}
					title="Nummerierte Schritte – Umschalt+Enter für eine graue Zusatzzeile"
					onclick={() => exec('insertOrderedList')}
				>
					1. Schritte
				</button>
				<span class="sep"></span>
				{#each COLORS as color (color.value)}
					<button
						class="swatch"
						style:--swatch={color.value}
						title={color.name}
						aria-label="Textfarbe {color.name}"
						onclick={() => exec('foreColor', color.value)}
					></button>
				{/each}
				<label class="custom-color" title="Eigene Farbe">
					<input type="color" aria-label="Eigene Textfarbe" onchange={(e) => exec('foreColor', e.currentTarget.value)} />
				</label>
				<span class="sep"></span>
				<button title="Link einfügen" onclick={addLink}>Link</button>
				<button title="Bild hinzufügen" onclick={() => fileInput?.click()}>Bild</button>
				<button title="Formatierung der Auswahl entfernen" onclick={() => exec('removeFormat')}>Format löschen</button>
				<input
					type="file"
					accept="image/png,image/jpeg,image/gif,image/webp"
					multiple
					hidden
					bind:this={fileInput}
					onchange={(e) => {
						upload([...(e.currentTarget.files ?? [])]);
						e.currentTarget.value = '';
					}}
				/>
			</div>

			<div
				class="content editable"
				contenteditable="true"
				role="textbox"
				aria-multiline="true"
				aria-label="Auftragstext"
				tabindex="0"
				data-placeholder="Was sollen die Schüler tun?"
				bind:this={editorEl}
				onpaste={onPaste}
			></div>
		{:else if isEmpty}
			<p class="empty">
				{canEdit ? 'Noch kein Auftrag – über „Bearbeiten“ erstellen.' : 'Aktuell gibt es keinen Auftrag.'}
			</p>
		{:else}
			{#if assignment.title}<h2>{assignment.title}</h2>{/if}
			<!-- Bei neuem Text komplett neu aufbauen – steps verschiebt Knoten, die @html sonst nicht mehr findet. -->
			{#key assignment.html}
				<div class="content" use:steps use:stepProgress={progress}>{@html assignment.html}</div>
			{/key}
		{/if}
	</div>

	{#if editing || shownImages.length > 0}
		<!-- Bilder rechts als Vorschau, groß per Klick -->
		<aside class="media" class:pair={shownImages.length === 2} class:multi={shownImages.length > 2}>
			{#each shownImages as id, i (id)}
				<div class="thumb">
					<button type="button" class="zoom-btn" aria-label="Bild {i + 1} vergrößern" onclick={() => (zoomed = fileUrl(id))}>
						<img src={fileUrl(id)} alt="" loading="lazy" />
						{#if !editing}<span class="zoom-label" aria-hidden="true">⤢ Bild {i + 1}</span>{/if}
					</button>
					{#if editing}
						<button
							type="button"
							class="remove icon-btn"
							aria-label="Bild entfernen"
							onclick={() => (images = images.filter((i) => i !== id))}>✕</button
						>
					{/if}
				</div>
			{/each}
			{#if editing}
				<button type="button" class="add-image" onclick={() => fileInput?.click()}>
					{uploading > 0 ? 'Wird hochgeladen…' : '+ Bild'}
				</button>
				<p class="help">Auch per Strg+V oder Hineinziehen</p>
			{/if}
		</aside>
	{/if}

	{#if cornerQr}
		<!-- Klein unten rechts, liegt über dem Inhalt (kein Verschieben); Klick zeigt ihn groß. -->
		<button class="corner-qr" onclick={openShare} title="QR-Code groß zeigen" aria-label="QR-Code groß zeigen">
			<svg viewBox="0 0 {cornerQr.size} {cornerQr.size}" shape-rendering="crispEdges" aria-hidden="true">
				<rect width={cornerQr.size} height={cornerQr.size} fill="#fff" />
				<path d={cornerQr.d} fill="#000" />
			</svg>
		</button>
	{/if}
</section>

{#if canEdit}
	<ShareAssignment
		bind:open={shareOpen}
		{share}
		bind:corner={() => corner, (value) => {
			corner = value;
			remember(CORNER_KEY, value ? 1 : 0);
		}}
	/>
	<GoalsFromAssignment bind:open={goalsOpen} steps={stepTexts} title={assignment.title} {students} {groups} />
	{#if owners.length > 1}<AssignmentTransfer bind:open={transferOpen} {owners} />{/if}
{/if}

{#if zoomed}
	<div class="lightbox" role="dialog" aria-modal="true" aria-label="Bild">
		<button class="lightbox-backdrop" aria-label="Schließen" onclick={() => (zoomed = null)}></button>
		<img src={zoomed} alt="" />
		<button class="lightbox-close icon-btn" aria-label="Schließen" onclick={() => (zoomed = null)}>✕</button>
	</div>
{/if}

<style>
	/* Text links, Bilder rechts; die Karte füllt auf der Startseite den freien Platz. */
	.assignment {
		position: relative;
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto 1fr;
		align-content: start;
		gap: 10px 32px;
		padding: 20px 28px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.assignment.with-images {
		/* Bildspalte in % der Karte (Bilder − / +), höchstens die Hälfte. */
		grid-template-columns: minmax(0, 1fr) var(--image-col, 270px);
	}

	/* Vollbild (⛶): Karte füllt den Bildschirm, Text etwas größer. */
	.assignment.fullscreen {
		overflow-y: auto;
		padding: 40px 56px;
		border: 0;
		border-radius: 0;
		font-size: 1.15em;
	}

	/* Anzeige: alle Vorschauen gleich zugeschnitten (4:3 aus der Bildmitte) – Hoch- und Querformat
	   sehen gleich aus. Bis zwei Bilder untereinander, ab drei ein 2er-Raster. Ganz: Großansicht. */
	.assignment:not(.editing) .media .zoom-btn img {
		aspect-ratio: 4 / 3;
	}

	/* Zwei Bilder untereinander etwas flacher, damit die Startseite ohne Scrollen passt. */
	.assignment:not(.editing) .media.pair .zoom-btn img {
		aspect-ratio: 3 / 2;
	}

	.assignment:not(.editing) .media.multi {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.zoom-btn {
		position: relative;
	}

	.zoom-label {
		position: absolute;
		right: 8px;
		bottom: 8px;
		padding: 2px 8px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--surface) 88%, transparent);
		color: var(--muted);
		box-shadow: 0 1px 3px rgb(0 0 0 / 15%);
		font-size: 12px;
		line-height: 1.5;
	}

	.media.multi .zoom-label {
		right: 5px;
		bottom: 5px;
		font-size: 11px;
	}

	/* Werkzeuge oben rechts: kleine umrandete Knöpfe. */
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
	}

	.tool {
		display: inline-grid;
		place-items: center;
		min-width: 32px;
		height: 28px;
		padding: 0 9px;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: transparent;
		color: var(--muted);
		font-size: 13px;
		font-weight: 600;
	}

	.tool:hover:not(:disabled) {
		color: var(--text);
		border-color: var(--muted);
	}

	.tool.img-size,
	.tool.with-icon {
		display: inline-flex;
		gap: 2px;
	}

	.tool.accent {
		border-color: var(--lesson-accent);
		background: color-mix(in srgb, var(--lesson-accent) 12%, transparent);
		color: var(--lesson-accent);
	}

	/* Geteilte Seite: etwas kleiner als am Beamer; A− / A+ wirken über --user-scale. */
	.assignment.plain {
		--scale: calc(0.76 * var(--user-scale, 1));
	}

	/* Auftrag ist geteilt */
	.tool.on {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}

	.corner-qr {
		position: absolute;
		right: 14px;
		bottom: 14px;
		z-index: 2;
		width: 132px;
		padding: 6px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: #fff;
		box-shadow: var(--shadow);
		cursor: zoom-in;
	}

	.corner-qr svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.fullscreen .corner-qr {
		position: fixed;
		width: 180px;
	}

	.main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	header {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.label {
		color: var(--lesson-accent);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.head-actions {
		display: flex;
		gap: 8px;
	}

	/* Dezente Text-Knöpfe, damit der Auftrag im Vordergrund steht. */
	.text-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 6px;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 14px;
	}

	.text-btn:hover {
		color: var(--text);
	}

	.text-btn.danger:hover {
		color: var(--danger);
	}

	h2 {
		margin-bottom: 4px;
		font-size: calc(42px * var(--scale, 1));
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: -0.01em;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}

	.content {
		font-size: calc(20px * var(--scale, 1));
		line-height: 1.5;
		overflow-wrap: anywhere;
		/* Lange Wörter bei großer Schrift an Silbengrenzen trennen (lang="de"). */
		hyphens: auto;
	}

	/* Anzeige: Spalte bis zum Kartenende, damit die Links unten stehen können. */
	.content:not(.editable) {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.content :global(:first-child) {
		margin-top: 0;
	}

	.content :global(:last-child) {
		margin-bottom: 0;
	}

	.content :global(p),
	.content :global(ul),
	.content :global(ol) {
		margin: 0 0 0.8em;
	}

	.content :global(ul) {
		padding-left: 1.4em;
	}

	.content :global(li) {
		margin: 0.2em 0;
	}

	/* Nummerierte Liste als Schritte: Zahl im Kreis, große Zeile, graue Zusatzzeile (Umschalt+Enter). */
	.content :global(ol) {
		padding: 0;
		list-style: none;
		counter-reset: step;
	}

	.content :global(ol > li) {
		position: relative;
		margin: 0;
		padding: 9px 0 9px calc(58px * var(--scale, 1));
		border-bottom: 1px solid var(--border);
		font-size: calc(29px * var(--scale, 1));
		font-weight: 600;
		line-height: 1.3;
		counter-increment: step;
	}

	.content :global(ol > li:last-child) {
		border-bottom: 0;
	}

	.content :global(ol > li::before) {
		content: counter(step);
		position: absolute;
		top: calc(9px + 2px * var(--scale, 1));
		left: 0;
		display: grid;
		place-items: center;
		width: calc(40px * var(--scale, 1));
		height: calc(40px * var(--scale, 1));
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: calc(18px * var(--scale, 1));
		font-weight: 700;
	}

	/* Fortschritt je Schritt rechts („✓ 7/11“), grün wenn alle fertig sind. */
	.content :global(ol > li:has(> .step-count)) {
		padding-right: 84px;
	}

	.content :global(ol > li > .step-count) {
		position: absolute;
		top: calc(12px + 2px * var(--scale, 1));
		right: 0;
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--track);
		color: var(--muted);
		font-size: 14px;
		font-weight: 700;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
	}

	.content :global(ol > li > .step-count.all) {
		background: var(--ok-soft);
		color: var(--ok);
	}

	.content :global(ol > li .sub) {
		display: block;
		margin-top: 2px;
		color: var(--muted);
		font-size: calc(17px * var(--scale, 1));
		font-weight: 400;
	}

	.content :global(h3),
	.content :global(h4) {
		margin: 1em 0 0.4em;
	}

	/* Links klein und unterstrichen, nur die Adresse ohne https:// (siehe steps). */
	.content :global(a) {
		color: var(--accent);
		font-size: calc(17px * var(--scale, 1));
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.content :global(a:hover) {
		text-decoration-thickness: 2px;
	}

	.content :global(a::before) {
		content: '🔗 ';
		display: inline-block;
		text-decoration: none;
	}

	/* Absätze, die nur Links enthalten, stehen gesammelt unten in der Karte. */
	.content :global(.links) {
		margin-top: auto;
		padding-top: 16px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.content :global(.links > *) {
		margin: 0;
	}

	.media {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.thumb {
		position: relative;
	}

	.zoom-btn {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		border-radius: 10px;
		overflow: hidden;
		background: var(--track);
		cursor: zoom-in;
	}

	.zoom-btn img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: cover;
	}

	/* Mehr als zwei Bilder: kompaktes 2er-Raster aus quadratischen Mini-Vorschauen. */
	.media.multi {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		align-content: start;
	}

	.media.multi .zoom-btn img {
		aspect-ratio: 1;
	}

	/* „+ Bild“ und Hinweise über die ganze Breite. */
	.media.multi .add-image,
	.media.multi .help {
		grid-column: 1 / -1;
	}

	.remove {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 0.8rem;
		box-shadow: var(--shadow);
	}

	.remove:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.add-image {
		padding: 12px;
		border: 2px dashed var(--border);
		border-radius: 10px;
		background: transparent;
		color: var(--muted);
	}

	.add-image:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Editor füllt den restlichen Bildschirm; lange Texte scrollen im Feld statt auf der Seite. */
	.editable {
		height: max(200px, calc(100vh - 384px));
		overflow-y: auto;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 10px;
		outline: none;
		font-size: 1.05rem;
		line-height: 1.5;
	}

	/* Im Editor die Schritte etwas kleiner, damit mehr Text Platz hat. */
	.editable :global(ol > li) {
		font-size: 19px;
	}

	/* --- Kompakter Bearbeitungsmodus (alles ohne Scrollen sichtbar) --- */
	.assignment.editing {
		gap: 10px 20px;
		padding: 16px 20px 18px;
	}

	/* Bild wird über die Karte gezogen: Rahmen und „+ Bild“ hervorheben. */
	.assignment.drag-over {
		border-color: var(--accent);
		box-shadow:
			0 0 0 3px var(--accent-soft),
			var(--shadow);
	}

	.assignment.drag-over .add-image {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}

	.assignment.editing.with-images {
		grid-template-columns: minmax(0, 1fr) 200px;
	}

	.editing .media {
		max-height: max(200px, calc(100vh - 330px));
		overflow-y: auto;
		gap: 10px;
		padding: 8px 8px 0 0;
	}

	.editable:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	.editable:empty::before {
		content: attr(data-placeholder);
		color: var(--muted);
	}

	.title-input {
		padding: 6px 10px;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		padding: 5px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg);
	}

	.toolbar button {
		min-width: 32px;
		height: 30px;
		padding: 0 8px;
		font-size: 0.9rem;
	}

	.toolbar button.on {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}

	.sep {
		width: 1px;
		height: 24px;
		margin: 0 4px;
		background: var(--border);
	}

	.toolbar .swatch {
		min-width: 0;
		width: 24px;
		height: 24px;
		padding: 0;
		border-radius: 50%;
		border: 2px solid var(--surface);
		background: var(--swatch);
		box-shadow: 0 0 0 1px var(--border);
	}

	.toolbar .swatch:hover {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.custom-color {
		display: inline-grid;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		overflow: hidden;
		box-shadow: 0 0 0 1px var(--border);
		background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
		cursor: pointer;
	}

	.custom-color input {
		opacity: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}

	.help {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.error {
		margin: 0;
		color: var(--danger);
	}

	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		padding: 24px;
	}

	.lightbox-backdrop {
		position: absolute;
		inset: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: rgb(10 15 30 / 80%);
		cursor: zoom-out;
	}

	.lightbox img {
		position: relative;
		max-width: 95vw;
		max-height: 90vh;
		object-fit: contain;
		border-radius: 10px;
		box-shadow: 0 10px 40px rgb(0 0 0 / 40%);
		pointer-events: none;
	}

	.lightbox-close {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		font-size: 1.2rem;
	}

	@media (max-width: 760px) {
		.assignment.with-images,
		.assignment.editing.with-images {
			grid-template-columns: minmax(0, 1fr);
		}

		/* Kopf, Bilder, Text untereinander – keine Zeile soll sich strecken. */
		.assignment {
			grid-template-rows: none;
		}

		header {
			order: -2;
		}

		/* Bilder über dem Text als Reihe kleiner Vorschauen. */
		.media,
		.media.multi {
			order: -1;
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
			gap: 8px;
		}

		.editing .media {
			max-height: none;
			padding: 0;
		}

		/* Bilder − / +: feste Breite der Vorschauen, damit jeder Klick sichtbar ist. */
		.assignment:not(.editing) .media {
			grid-template-columns: repeat(auto-fill, var(--thumb, 27%));
		}

		.assignment:not(.editing) .media .thumb:only-of-type {
			grid-column: auto;
		}

		.media .zoom-btn img {
			aspect-ratio: 1;
		}

		.media .add-image,
		.media .help {
			grid-column: 1 / -1;
		}

		/* Geteilte Seite: Bilder groß unter dem Text (Links bleiben darunter). */
		.assignment.plain .media,
		.assignment.plain .media.multi {
			order: 0;
		}

		.assignment.plain .media .zoom-btn img {
			aspect-ratio: 4 / 3;
		}
	}

	@media (max-width: 640px) {
		.assignment,
		.assignment.editing {
			gap: 16px;
			padding: 16px;
		}

		/* Geteilte Seite: ohne Kartenrahmen, ganze Breite. */
		.assignment.plain {
			--scale: var(--user-scale, 1);
			padding: 4px 0 0;
			border: 0;
			background: transparent;
			box-shadow: none;
		}

		header {
			flex-wrap: wrap;
		}

		/* Kleinere Grundgrößen, A− / A+ wirken aber weiterhin (--scale). */
		h2 {
			font-size: calc(26px * var(--scale, 1));
		}

		.content {
			font-size: calc(17px * var(--scale, 1));
		}

		.content :global(ol > li) {
			padding-left: calc(42px * var(--scale, 1));
			font-size: calc(19px * var(--scale, 1));
		}

		.content :global(ol > li::before) {
			width: calc(28px * var(--scale, 1));
			height: calc(28px * var(--scale, 1));
			font-size: calc(14px * var(--scale, 1));
		}

		/* Auf dem Smartphone scrollt die Seite – der Editor braucht keine feste Höhe. */
		.editable {
			height: auto;
			min-height: 220px;
		}

		.lightbox {
			padding: 8px;
		}

		.lightbox img {
			max-width: 100%;
			max-height: 85vh;
		}

		.lightbox-close {
			top: 10px;
			right: 10px;
		}
	}
</style>
