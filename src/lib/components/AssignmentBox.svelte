<script>
	import { tick } from 'svelte';
	import { ui } from '#lib/ui.svelte.js';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import Icon from './Icon.svelte';

	/** @type {{ assignment: import('#lib/server/assignment.js').Assignment, canEdit: boolean }} */
	let { assignment, canEdit } = $props();

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
	const fileUrl = (id) => `/api/files/${id}`;

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
		if (!confirm('Auftrag wirklich löschen? Titel, Text und Bilder werden entfernt.')) return;
		try {
			await api('/api/assignment', 'DELETE');
		} catch (err) {
			alert(err instanceof Error ? err.message : String(err));
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

	function addLink() {
		const url = prompt('Adresse des Links (https://…)')?.trim();
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
				form.append('file', file);
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

	/** @param {DragEvent} e */
	function onDrop(e) {
		const files = [...(e.dataTransfer?.files ?? [])];
		if (!files.length) return;
		e.preventDefault();
		upload(files);
	}

	/**
	 * Schritte der nummerierten Liste: Text nach dem ersten Zeilenumbruch (Umschalt+Enter)
	 * als graue Zusatzzeile anzeigen. Nur fürs Anzeigen – gespeichert bleibt das HTML unverändert.
	 * @param {HTMLElement} node
	 * @param {string} _html neu anwenden, wenn sich der Auftrag ändert
	 */
	function steps(node, _html) {
		function apply() {
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
		return { update: apply };
	}
</script>

<svelte:document onselectionchange={onSelectionChange} />
<svelte:window onkeydown={(e) => e.key === 'Escape' && (zoomed = null)} />

<section class="assignment" class:editing class:with-images={editing || shownImages.length > 0}>
	<div class="main">
		<header>
			<span class="label">{editing ? 'Auftrag bearbeiten' : 'Auftrag'}</span>
			{#if canEdit && !editing}
				<div class="head-actions">
					<button class="text-btn" onclick={startEdit}><Icon name="pencil" size={13} /> Bearbeiten</button>
					{#if !isEmpty}<button class="text-btn danger" onclick={remove}>Löschen</button>{/if}
				</div>
			{:else if editing}
				<!-- Oben statt unter dem Editor – so muss man zum Speichern nicht scrollen. -->
				<div class="head-actions">
					<button onclick={() => (editing = false)} disabled={saving}>Abbrechen</button>
					<button class="primary" onclick={save} disabled={saving || uploading > 0}>
						{uploading > 0 ? 'Bild lädt…' : 'Speichern'}
					</button>
				</div>
			{/if}
		</header>
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
				ondrop={onDrop}
				ondragover={(e) => e.preventDefault()}
			></div>
		{:else if isEmpty}
			<p class="empty">
				{canEdit ? 'Noch kein Auftrag – über „Bearbeiten“ erstellen.' : 'Aktuell gibt es keinen Auftrag.'}
			</p>
		{:else}
			{#if assignment.title}<h2>{assignment.title}</h2>{/if}
			<div class="content" use:steps={assignment.html}>{@html assignment.html}</div>
		{/if}
	</div>

	{#if editing || shownImages.length > 0}
		<!-- Bilder rechts als Vorschau, groß per Klick -->
		<aside class="media" class:multi={shownImages.length > 2}>
			{#each shownImages as id (id)}
				<div class="thumb">
					<button type="button" class="zoom-btn" aria-label="Bild vergrößern" onclick={() => (zoomed = fileUrl(id))}>
						<img src={fileUrl(id)} alt="" loading="lazy" />
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
			{:else}
				<p class="help caption">Klick vergrößert</p>
			{/if}
		</aside>
	{/if}
</section>

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
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 32px;
		padding: 24px 28px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.assignment.with-images {
		grid-template-columns: minmax(0, 1fr) 270px;
	}

	.main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	header {
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
		font-size: 36px;
		line-height: 1.15;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}

	.content {
		font-size: 19px;
		line-height: 1.5;
		overflow-wrap: anywhere;
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
		padding: 8px 0 8px 50px;
		border-bottom: 1px solid var(--border);
		font-size: 23px;
		font-weight: 500;
		line-height: 1.3;
		counter-increment: step;
	}

	.content :global(ol > li:last-child) {
		border-bottom: 0;
	}

	.content :global(ol > li::before) {
		content: counter(step);
		position: absolute;
		top: 8px;
		left: 0;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--track);
		color: var(--lesson-accent);
		font-size: 16px;
		font-weight: 700;
	}

	.content :global(ol > li .sub) {
		display: block;
		margin-top: 2px;
		color: var(--muted);
		font-size: 16px;
		font-weight: 400;
	}

	.content :global(h3),
	.content :global(h4) {
		margin: 1em 0 0.4em;
	}

	.content :global(a) {
		color: var(--lesson-accent);
		text-decoration: none;
	}

	.content :global(a:hover) {
		text-decoration: underline;
	}

	.content :global(a::before) {
		content: '🔗 ';
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

	.caption {
		text-align: center;
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
		gap: 20px;
		padding: 16px 20px 18px;
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

		.media .zoom-btn img {
			aspect-ratio: 1;
		}

		.media .add-image,
		.media .help {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 640px) {
		.assignment,
		.assignment.editing {
			gap: 16px;
			padding: 16px;
		}

		header {
			flex-wrap: wrap;
		}

		h2 {
			font-size: 26px;
		}

		.content {
			font-size: 17px;
		}

		.content :global(ol > li) {
			padding-left: 42px;
			font-size: 19px;
		}

		.content :global(ol > li::before) {
			width: 28px;
			height: 28px;
			font-size: 14px;
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
