<script>
	import { tick } from 'svelte';
	import { ui } from '#lib/ui.svelte.js';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { navIcon } from '#lib/nav.js';
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

	// Beim Bearbeiten Platz schaffen: Kopfzeile ohne Balken/Uhr/Ampel (siehe Header).
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
</script>

<svelte:document onselectionchange={onSelectionChange} />
<svelte:window onkeydown={(e) => e.key === 'Escape' && (zoomed = null)} />

<section class="assignment" class:editing>
	<header>
		<span class="label">
			<span class="label-icon"><Icon name={navIcon('/')} size={22} /></span>
			{editing ? 'Auftrag bearbeiten' : 'Auftrag'}
		</span>
		{#if canEdit && !editing}
			<div class="head-actions">
				<button onclick={startEdit}>Bearbeiten</button>
				{#if !isEmpty}<button class="danger" onclick={remove}>Löschen</button>{/if}
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
		<input type="text" class="title-input" bind:value={title} placeholder="Titel, z. B. Auftrag 3: Bruchrechnen" maxlength="120" />

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
			<button class:on={active.ol} aria-pressed={active.ol} title="Nummerierte Liste" onclick={() => exec('insertOrderedList')}>
				1. Liste
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
	{:else if isEmpty}
		<p class="empty">
			{canEdit ? 'Noch kein Auftrag – über „Bearbeiten“ erstellen.' : 'Aktuell gibt es keinen Auftrag.'}
		</p>
	{:else if assignment.title}
		<h2>{assignment.title}</h2>
	{/if}

	{#if editing || !isEmpty}
		<div class="layout" class:with-images={editing || shownImages.length > 0}>
			{#if editing || shownImages.length > 0}
				<div class="media" class:multi={shownImages.length > 1}>
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
					{/if}
				</div>
			{/if}

			{#if editing}
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
			{:else}
				<div class="content">{@html assignment.html}</div>
			{/if}
		</div>
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
	.assignment {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 24px 28px;
		border: 1px solid var(--border);
		border-left: 6px solid var(--accent);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.head-actions {
		display: flex;
		gap: 8px;
	}

	.label-icon {
		display: inline-grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--accent-soft);
	}

	.label {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}

	h2 {
		font-size: 1.8rem;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}

	/* Bilder links, Auftragstext rechts daneben. */
	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 24px;
		align-items: start;
	}

	/* Schmale Bildspalte – die Bilder sind nur Vorschauen, groß gibt es sie per Klick. */
	.layout.with-images {
		grid-template-columns: minmax(140px, 200px) minmax(0, 1fr);
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
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg);
		box-shadow: var(--shadow);
		cursor: zoom-in;
	}

	/* Beim Darüberfahren ruhig bleiben – nur der Lupen-Cursor zeigt, dass man klicken kann. */
	.zoom-btn:hover {
		border-color: var(--border);
	}

	.zoom-btn img {
		display: block;
		width: 100%;
		max-height: 170px;
		object-fit: contain;
	}

	/* Mehrere Bilder: kompaktes 2er-Raster aus quadratischen Mini-Vorschauen. */
	.media.multi {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		align-content: start;
	}

	.media.multi .zoom-btn img {
		aspect-ratio: 1;
		max-height: none;
		object-fit: cover;
	}

	/* „+ Bild“ und Hinweis im Bearbeitungsmodus über die ganze Breite. */
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
		padding: 18px;
		border: 2px dashed var(--border);
		border-radius: 10px;
		background: transparent;
		color: var(--muted);
	}

	.add-image:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.content {
		font-size: 1.25rem;
		line-height: 1.55;
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

	.content :global(ul),
	.content :global(ol) {
		padding-left: 1.4em;
	}

	.content :global(li) {
		margin: 0.2em 0;
	}

	.content :global(h3),
	.content :global(h4) {
		margin: 1em 0 0.4em;
	}

	.content :global(a) {
		color: var(--accent);
	}

	/* Editor füllt den restlichen Bildschirm; lange Texte scrollen im Feld statt auf der Seite. */
	.editable {
		height: max(200px, calc(100vh - 330px));
		overflow-y: auto;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 10px;
		outline: none;
		font-size: 1.05rem;
		line-height: 1.5;
	}

	/* --- Kompakter Bearbeitungsmodus (alles ohne Scrollen sichtbar) --- */
	.assignment.editing {
		gap: 10px;
		padding: 14px 20px 18px;
	}

	.editing .layout {
		gap: 16px;
	}

	.editing .layout.with-images {
		grid-template-columns: minmax(140px, 200px) minmax(0, 1fr);
	}

	.editing .media {
		max-height: max(200px, calc(100vh - 330px));
		overflow-y: auto;
		gap: 10px;
		padding: 8px 8px 0 0;
	}

	.editing .zoom-btn img {
		max-height: 130px;
	}

	.editing .add-image {
		padding: 10px;
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
		.layout.with-images,
		.editing .layout.with-images {
			grid-template-columns: 1fr;
		}

		.editing .media {
			max-height: none;
			padding: 0;
		}

		.media {
			flex-direction: row;
			flex-wrap: wrap;
		}

		.thumb {
			width: 140px;
		}

		.media.multi {
			grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
		}

		.media.multi .thumb {
			width: auto;
		}
	}

	@media (max-width: 640px) {
		.assignment,
		.assignment.editing {
			padding: 14px 14px 16px;
			border-left-width: 4px;
		}

		header {
			flex-wrap: wrap;
		}

		h2 {
			font-size: 1.35rem;
		}

		.content {
			font-size: 1.05rem;
		}

		.thumb {
			width: 110px;
		}

		.media.multi {
			grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
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
