<script>
	import { onMount, tick } from 'svelte';
	import { askText } from '#lib/dialog.svelte.js';
	import {
		BOXES,
		CELL_COLORS,
		History,
		anchorIn,
		blockTypeAt,
		cellAt,
		closestIn,
		colorCells,
		handleBlockKeys,
		indent,
		insertBadge,
		insertBox,
		insertRule,
		insertTable,
		insertVideo,
		listTypeOf,
		moveCell,
		outdent,
		prepareEditable,
		setListType,
		tableAction,
		youtubeId
	} from '#lib/editor.js';
	import Icon from './Icon.svelte';

	/**
	 * Werkzeugleiste des Auftrags-Editors: Absatz, B/I/U, Listenarten, Link, Bild, Tabelle, Bausteine,
	 * Rückgängig. Dazu die kleine Tabellen-Leiste unter einer Tabelle und das „/“-Menü an der Cursorstelle.
	 * @type {{ editor: HTMLElement | undefined, onImage: () => void, onError: (message: string) => void }}
	 */
	let { editor, onImage, onError } = $props();

	// Kein Schwarz: Normaler Text passt sich dem Theme an, festes Schwarz wäre im Dunkelmodus unlesbar.
	const COLORS = [
		{ name: 'Rot', value: '#d63c3c' },
		{ name: 'Blau', value: '#3767d6' },
		{ name: 'Grün', value: '#23905a' },
		{ name: 'Orange', value: '#e08a00' },
		{ name: 'Lila', value: '#8b44c9' }
	];

	const PARAGRAPHS = /** @type {const} */ ([
		{ tag: 'p', label: 'Absatz', hint: 'normaler Text' },
		{ tag: 'h3', label: 'Überschrift', hint: 'für Abschnitte' },
		{ tag: 'h4', label: 'Unterüberschrift', hint: 'kleiner' }
	]);

	const LISTS = /** @type {const} */ ([
		{ type: 'bullets', icon: '•', label: 'Punkte', hint: 'für Aufzählungen' },
		{ type: 'nums', icon: '1.', label: 'Nummern', hint: 'Reihenfolge, klein' },
		{ type: 'steps', icon: '①', label: 'Schritte', hint: 'groß am Beamer' },
		{ type: 'check', icon: '☐', label: 'Checkliste', hint: 'Schüler können abhaken' },
		{ type: 'letters', icon: 'a)', label: 'Buchstaben', hint: 'Teilaufgaben' },
		{ type: 'arrows', icon: '→', label: 'Pfeile', hint: 'Hinweise, Folgerungen' },
		{ type: 'stars', icon: '★', label: 'Wichtig', hint: 'hervorgehobene Punkte' }
	]);

	const BLOCKS = /** @type {const} */ ([
		{ key: 'material', icon: '📦', label: 'Material' },
		{ key: 'tip', icon: '💡', label: 'Tipp' },
		{ key: 'warn', icon: '⚠️', label: 'Wichtig' },
		{ key: 'time', icon: '⏱', label: 'Zeitangabe' },
		{ key: 'social', icon: '👥', label: 'Sozialform' },
		{ key: 'profi', icon: '★', label: 'Profi-Aufgabe' },
		{ key: 'video', icon: '▶', label: 'Video / YouTube' },
		{ key: 'rule', icon: '—', label: 'Trennlinie' }
	]);

	const SOCIAL = ['einzeln', 'zu zweit', 'Gruppe'];

	/** @type {['addRow' | 'addCol' | 'delRow' | 'delCol', string][]} */
	const TABLE_ACTIONS = [
		['addRow', '+ Zeile'],
		['addCol', '+ Spalte'],
		['delRow', '− Zeile'],
		['delCol', '− Spalte']
	];

	/** @type {null | 'para' | 'list' | 'table' | 'block'} */
	let open = $state(null);
	/** Untermenü „Sozialform“ im Baustein-Menü */
	let socialOpen = $state(false);
	/** Raster „Tabelle“: Spalten × Zeilen unter der Maus */
	let grid = $state({ cols: 3, rows: 3 });
	let active = $state({ bold: false, italic: false, underline: false, list: '', block: 'p' });

	// „/“-Menü an der Cursorstelle; Bausteine auch per Tastatur (↑ ↓ Enter).
	/** @type {{ x: number, y: number, node: Text, offset: number } | null} */
	let slash = $state(null);
	let slashIndex = $state(0);

	// Tabellen-Leiste unter der Tabelle mit dem Cursor
	/** @type {{ x: number, y: number, header: boolean, cell: { x: number, y: number, w: number, h: number } | null } | null} */
	let tableBar = $state(null);
	let cellColorsOpen = $state(false);

	let history = /** @type {History | null} */ (null);
	let undoState = $state({ undo: false, redo: false });

	/** @type {Range | null} */
	let lastRange = null;

	/** Nach dem Laden des Textes: Verlauf neu beginnen. */
	export function reset() {
		if (!editor) return;
		prepareEditable(editor);
		// Neue Zeilen als <p> statt <div> (wie die übrigen Absätze).
		document.execCommand('defaultParagraphSeparator', false, 'p');
		history = new History(editor);
		history.reset();
		lastRange = null;
		updateUndo();
	}

	function updateUndo() {
		undoState = { undo: !!history?.canUndo, redo: !!history?.canRedo };
	}

	function restore() {
		editor?.focus();
		if (!lastRange) return;
		const sel = document.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(lastRange);
	}

	/**
	 * Eine Änderung ausführen: Auswahl zurückholen, Tippen abschließen, ändern, im Verlauf festhalten.
	 * @param {() => void} change
	 */
	function run(change) {
		if (!editor) return;
		restore();
		history?.flush();
		change();
		history?.record();
		updateUndo();
		refresh();
	}

	/** execCommand ist als veraltet markiert, wird aber von allen Browsern unterstützt. @param {string} command @param {string} [value] */
	const exec = (command, value) => run(() => document.execCommand(command, false, value));

	function close() {
		open = null;
		socialOpen = false;
		cellColorsOpen = false;
	}

	/** @param {NonNullable<typeof open>} menu */
	function toggle(menu) {
		const next = open === menu ? null : menu;
		close();
		open = next;
		slash = null;
	}

	function refresh() {
		const sel = document.getSelection();
		if (!editor || !sel?.rangeCount || !editor.contains(sel.anchorNode)) return;
		lastRange = sel.getRangeAt(0).cloneRange();
		/** @param {string} command */
		const state = (command) => {
			try {
				return document.queryCommandState(command);
			} catch {
				return false;
			}
		};
		const list = closestIn(anchorIn(editor), 'ul, ol', editor);
		active = {
			bold: state('bold'),
			italic: state('italic'),
			underline: state('underline'),
			list: list ? listTypeOf(list) : '',
			block: blockTypeAt(editor)
		};
		placeTableBar();
	}

	function placeTableBar() {
		const cell = editor ? cellAt(editor) : null;
		const table = cell?.closest('table');
		if (!editor || !table) {
			tableBar = null;
			cellColorsOpen = false;
			return;
		}
		const t = table.getBoundingClientRect();
		const box = editor.getBoundingClientRect();
		// Unter der Tabelle; passt das nicht in den sichtbaren Teil des Editors, darüber.
		const below = t.bottom + 10;
		const above = t.top - 48;
		const y = below + 44 <= box.bottom ? below : above >= box.top ? above : Math.min(below, box.bottom - 50);
		const c = cell.getBoundingClientRect();
		const cellBox = c.bottom > box.top && c.top < box.bottom ? { x: c.left, y: c.top, w: c.width, h: c.height } : null;
		tableBar = { x: Math.max(box.left + 8, t.left), y: Math.max(box.top + 8, y), header: !!table.tHead, cell: cellBox };
	}

	// --- Link ---

	async function addLink() {
		close();
		const url = (
			await askText({ title: 'Link einfügen', message: 'Adresse des Links:', placeholder: 'https://…', confirmLabel: 'Einfügen' })
		)?.trim();
		if (!url) return;
		if (!/^(https?:\/\/|mailto:)/i.test(url)) {
			onError('Links müssen mit https:// (oder http://) beginnen.');
			return;
		}
		restore();
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

	// --- Bausteine ---

	/** @param {string} key */
	async function insertBlock(key) {
		if (!editor) return;
		const root = editor;
		if (key === 'social') {
			socialOpen = !socialOpen;
			return;
		}
		close();
		takeSlash();
		if (key in BOXES) return run(() => insertBox(root, /** @type {keyof typeof BOXES} */ (key)));
		if (key === 'rule') return run(() => insertRule(root));
		if (key === 'profi') return run(() => insertBadge(root, 'profi', 'Profi'));
		if (key === 'time') {
			const value = await askText({ title: 'Zeitangabe', message: 'Wie viele Minuten?', value: '10', confirmLabel: 'Einfügen' });
			const minutes = Number(value?.replace(',', '.').trim());
			if (!value) return restore();
			if (!(minutes > 0 && minutes <= 600)) return onError('Bitte eine Zahl von Minuten eingeben, z. B. 10.');
			return run(() => insertBadge(root, 'time', `${Math.round(minutes)} min`));
		}
		if (key === 'video') {
			const value = await askText({
				title: 'Video einfügen',
				message: 'Adresse des YouTube-Videos:',
				placeholder: 'https://www.youtube.com/watch?v=…',
				confirmLabel: 'Einfügen'
			});
			if (!value) return restore();
			const id = youtubeId(value);
			if (!id) return onError('Das ist keine YouTube-Adresse.');
			return run(() => insertVideo(root, id));
		}
	}

	/** @param {string} text */
	function insertSocial(text) {
		if (!editor) return;
		const root = editor;
		close();
		takeSlash();
		run(() => insertBadge(root, 'social', text));
	}

	/** Das getippte „/“ wieder entfernen, bevor der Baustein eingefügt wird. */
	function takeSlash() {
		if (!slash) return;
		const { node, offset } = slash;
		slash = null;
		if (!node.isConnected || node.textContent?.[offset] !== '/') return;
		const range = document.createRange();
		range.setStart(node, offset);
		range.setEnd(node, offset + 1);
		range.deleteContents();
		range.collapse(true);
		lastRange = range;
	}

	// --- Tastatur und Eingaben im Editor ---

	/** @param {KeyboardEvent} e */
	function onKeydown(e) {
		if (!editor) return;
		const root = editor;
		const mod = e.ctrlKey || e.metaKey;
		if (slash) {
			const items = slashItems();
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				slashIndex = (slashIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
				return;
			}
			if (e.key === 'Enter') {
				e.preventDefault();
				const item = items[slashIndex];
				if (item.social) insertSocial(item.social);
				else insertBlock(item.key);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				slash = null;
				return;
			}
			if (e.key !== 'Shift') slash = null;
		}
		if (mod && !e.altKey && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
			e.preventDefault();
			if (e.key === 'y' || e.shiftKey) history?.redo();
			else history?.undo();
			updateUndo();
			refresh();
			return;
		}
		if (e.key === 'Tab' && !mod && !e.altKey) {
			const inTable = !!cellAt(root);
			const inList = !!closestIn(anchorIn(root), 'li', root);
			if (!inTable && !inList) return;
			e.preventDefault();
			history?.flush();
			if (inTable) moveCell(root, e.shiftKey);
			else if (e.shiftKey) outdent(root);
			else indent(root);
			history?.record();
			updateUndo();
			refresh();
			return;
		}
		if (e.key === 'Enter' || e.key === 'Backspace') {
			history?.flush();
			if (handleBlockKeys(root, e)) {
				e.preventDefault();
				history?.record();
				updateUndo();
				refresh();
			}
		}
	}

	/** Undo/Redo des Browsers (z. B. aus dem Kontextmenü) durch den eigenen Verlauf ersetzen. @param {InputEvent} e */
	function onBeforeInput(e) {
		if (e.inputType !== 'historyUndo' && e.inputType !== 'historyRedo') return;
		e.preventDefault();
		if (e.inputType === 'historyUndo') history?.undo();
		else history?.redo();
		updateUndo();
	}

	/** @param {Event} event */
	function onInput(event) {
		const e = /** @type {InputEvent} */ (event);
		history?.schedule();
		updateUndo();
		if (e.inputType !== 'insertText' || e.data !== '/') return;
		// „/“ am Zeilenanfang oder nach einem Leerzeichen öffnet das Baustein-Menü.
		const sel = document.getSelection();
		const node = sel?.anchorNode;
		const offset = (sel?.anchorOffset ?? 0) - 1;
		if (!node || node.nodeType !== Node.TEXT_NODE || offset < 0) return;
		const before = node.textContent?.[offset - 1];
		if (before !== undefined && !/\s| /.test(before)) return;
		const range = document.createRange();
		range.setStart(node, offset);
		range.setEnd(node, offset + 1);
		const rect = range.getBoundingClientRect();
		close();
		slashIndex = 0;
		const text = /** @type {Text} */ (node);
		slash = { x: rect.left, y: rect.bottom + 6, node: text, offset };
		tick().then(fitSlash);
	}

	/** @type {HTMLDivElement | undefined} */
	let slashEl = $state();

	/** „/“-Menü an die aktuelle Stelle des Schrägstrichs setzen. */
	function placeSlash() {
		if (!slash) return;
		const { node, offset } = slash;
		if (!node.isConnected || node.textContent?.[offset] !== '/') {
			slash = null;
			return;
		}
		const range = document.createRange();
		range.setStart(node, offset);
		range.setEnd(node, offset + 1);
		const rect = range.getBoundingClientRect();
		slash.x = rect.left;
		slash.y = rect.bottom + 6;
		tick().then(fitSlash);
	}

	/** Menü nicht unten aus dem Fenster ragen lassen. */
	function fitSlash() {
		if (!slash || !slashEl) return;
		const r = slashEl.getBoundingClientRect();
		if (r.bottom > window.innerHeight - 8) slash.y = Math.max(8, slash.y - r.height - 32);
		if (r.right > window.innerWidth - 8) slash.x = Math.max(8, window.innerWidth - r.width - 8);
	}

	/** Einträge des „/“-Menüs in Reihenfolge (Sozialform aufgeklappt). */
	function slashItems() {
		/** @type {{ key: string, social?: string }[]} */
		const items = [];
		for (const b of BLOCKS) {
			if (b.key === 'social') for (const s of SOCIAL) items.push({ key: 'social', social: s });
			else items.push({ key: b.key });
		}
		return items;
	}

	onMount(() => {
		/** @param {MouseEvent} e */
		const onDown = (e) => {
			const t = /** @type {HTMLElement} */ (e.target);
			if (t.closest('.rt-menu, .rt-pop')) return;
			close();
			slash = null;
			if (!editor?.contains(t)) tableBar = null;
		};
		const onScroll = () => {
			placeSlash();
			placeTableBar();
		};
		window.addEventListener('mousedown', onDown);
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('mousedown', onDown);
			window.removeEventListener('resize', onScroll);
		};
	});

	$effect(() => {
		const el = editor;
		if (!el) return;
		// Der Editor scrollt beim Tippen mit – Menü und Tabellen-Leiste mitführen.
		const scroll = () => {
			placeSlash();
			placeTableBar();
		};
		el.addEventListener('keydown', onKeydown);
		el.addEventListener('beforeinput', onBeforeInput);
		el.addEventListener('input', onInput);
		el.addEventListener('scroll', scroll);
		return () => {
			el.removeEventListener('keydown', onKeydown);
			el.removeEventListener('beforeinput', onBeforeInput);
			el.removeEventListener('input', onInput);
			el.removeEventListener('scroll', scroll);
		};
	});

	/** Buttons sollen dem Editor den Fokus (und damit die Auswahl) nicht wegnehmen. @param {MouseEvent} e */
	function keepFocus(e) {
		if (/** @type {HTMLElement} */ (e.target).closest('button')) e.preventDefault();
	}
</script>

<svelte:document onselectionchange={refresh} />

<div class="rt-menu toolbar" role="toolbar" aria-label="Formatierung" tabindex="-1" onmousedown={keepFocus}>
	<div class="drop">
		<button class="txt" class:open={open === 'para'} onclick={() => toggle('para')} aria-haspopup="menu" aria-expanded={open === 'para'}>
			Absatz <span class="caret">▾</span>
		</button>
		{#if open === 'para'}
			<div class="menu para" role="menu">
				{#each PARAGRAPHS as p (p.tag)}
					<button class="item" class:on={active.block === p.tag} role="menuitem" onclick={() => (close(), exec('formatBlock', p.tag))}>
						<span class="item-icon {p.tag}">{p.tag === 'p' ? '¶' : p.tag === 'h3' ? 'H' : 'h'}</span>
						<span class="item-text"><strong>{p.label}</strong><small>{p.hint}</small></span>
					</button>
				{/each}
				<div class="menu-sep"></div>
				<div class="menu-head">Textfarbe</div>
				<div class="colors">
					{#each COLORS as color (color.value)}
						<button
							class="swatch"
							style:--swatch={color.value}
							title={color.name}
							aria-label="Textfarbe {color.name}"
							onclick={() => (close(), exec('foreColor', color.value))}
						></button>
					{/each}
					<label class="custom-color" title="Eigene Farbe">
						<input type="color" aria-label="Eigene Textfarbe" onchange={(e) => (close(), exec('foreColor', e.currentTarget.value))} />
					</label>
				</div>
				<button class="item plain" role="menuitem" onclick={() => (close(), exec('removeFormat'))}>Format löschen</button>
			</div>
		{/if}
	</div>

	<button class="sq" class:on={active.bold} aria-pressed={active.bold} title="Fett (Strg+B)" onclick={() => exec('bold')}><strong>B</strong></button>
	<button class="sq" class:on={active.italic} aria-pressed={active.italic} title="Kursiv (Strg+I)" onclick={() => exec('italic')}><em>I</em></button>
	<button class="sq" class:on={active.underline} aria-pressed={active.underline} title="Unterstrichen (Strg+U)" onclick={() => exec('underline')}>
		<u>U</u>
	</button>
	<span class="sep"></span>

	<div class="drop">
		<button
			class="txt"
			class:open={open === 'list'}
			class:on={!!active.list && open !== 'list'}
			onclick={() => toggle('list')}
			aria-haspopup="menu"
			aria-expanded={open === 'list'}
			title="Listen – Tab rückt ein (Unterliste), Umschalt+Tab wieder aus"
		>
			☰ Liste <span class="caret">▾</span>
		</button>
		{#if open === 'list'}
			<div class="menu list" role="menu">
				{#each LISTS as l (l.type)}
					<button
						class="item"
						class:on={active.list === l.type}
						role="menuitem"
						onclick={() => {
							close();
							const root = editor;
							if (root) run(() => setListType(root, l.type));
						}}
					>
						<span class="item-icon list-{l.type}">{l.icon}</span>
						<span class="item-text"><strong>{l.label}</strong><small>{l.hint}</small></span>
					</button>
				{/each}
				<p class="menu-foot">Tab: Unterliste · Umschalt+Tab: zurück</p>
			</div>
		{/if}
	</div>
	<span class="sep"></span>

	<button class="sq" title="Link einfügen" aria-label="Link einfügen" onclick={addLink}><Icon name="link" size={15} /></button>
	<button class="sq" title="Bild hinzufügen" aria-label="Bild hinzufügen" onclick={() => (close(), onImage())}><Icon name="image" size={15} /></button>
	<div class="drop">
		<button
			class="sq"
			class:open={open === 'table'}
			title="Tabelle einfügen"
			aria-label="Tabelle einfügen"
			aria-haspopup="menu"
			aria-expanded={open === 'table'}
			onclick={() => toggle('table')}
		>
			<Icon name="table" size={15} />
		</button>
		{#if open === 'table'}
			<div class="menu grid-menu" role="menu">
				<div class="grid" role="group" aria-label="Größe der Tabelle">
					{#each Array.from({ length: 6 }, (_, r) => r + 1) as r (r)}
						{#each Array.from({ length: 6 }, (_, c) => c + 1) as c (c)}
							<button
								class="cell"
								class:on={c <= grid.cols && r <= grid.rows}
								aria-label="{c} × {r}"
								onmouseenter={() => (grid = { cols: c, rows: r })}
								onfocus={() => (grid = { cols: c, rows: r })}
								onclick={() => {
									close();
									const root = editor;
									if (root) run(() => insertTable(root, c, r));
								}}
							></button>
						{/each}
					{/each}
				</div>
				<p class="grid-size">{grid.cols} × {grid.rows}</p>
			</div>
		{/if}
	</div>
	<span class="sep"></span>

	<div class="drop">
		<button
			class="txt baustein"
			class:open={open === 'block'}
			onclick={() => toggle('block')}
			aria-haspopup="menu"
			aria-expanded={open === 'block'}
		>
			+ Baustein <span class="caret">▾</span>
		</button>
		{#if open === 'block'}
			<div class="menu blocks" role="menu">
				{@render blockMenu(-1)}
			</div>
		{/if}
	</div>
	<span class="sep"></span>

	<button
		class="sq"
		title="Rückgängig (Strg+Z)"
		aria-label="Rückgängig"
		disabled={!undoState.undo}
		onclick={() => {
			restore();
			history?.undo();
			updateUndo();
		}}>↶</button
	>
	<button
		class="sq"
		title="Wiederholen (Strg+Y)"
		aria-label="Wiederholen"
		disabled={!undoState.redo}
		onclick={() => {
			restore();
			history?.redo();
			updateUndo();
		}}>↷</button
	>
</div>

{#snippet blockMenu(highlight)}
	<p class="menu-head">Baustein einfügen</p>
	{#each BLOCKS as b, i (b.key)}
		{@const index = slashItems().findIndex((it) => it.key === b.key)}
		<button
			class="item row"
			class:on={b.key !== 'social' && highlight === index}
			class:open={b.key === 'social' && socialOpen}
			role="menuitem"
			data-i={i}
			onclick={() => insertBlock(b.key)}
		>
			<span class="row-icon">{b.icon}</span>{b.label}{#if b.key === 'social'}<span class="more">{socialOpen ? '▾' : '▸'}</span>{/if}
		</button>
		{#if b.key === 'social' && (socialOpen || highlight >= 0)}
			<div class="sub-items">
				{#each SOCIAL as s, j (s)}
					<button class="item row small" class:on={highlight === index + j} role="menuitem" onclick={() => insertSocial(s)}>{s}</button>
				{/each}
			</div>
		{/if}
	{/each}
	<p class="menu-foot">Tipp: „/“ tippen öffnet dieses Menü</p>
{/snippet}

{#if slash}
	<div
		class="rt-menu menu blocks slash floating"
		role="menu"
		tabindex="-1"
		style:left="{slash.x}px"
		style:top="{slash.y}px"
		bind:this={slashEl}
		onmousedown={keepFocus}
	>
		{@render blockMenu(slashIndex)}
	</div>
{/if}

{#if tableBar?.cell}
	<!-- Zelle mit dem Cursor umrahmen (nur Anzeige, nicht im gespeicherten Text). -->
	<div
		class="cell-mark"
		style:left="{tableBar.cell.x}px"
		style:top="{tableBar.cell.y}px"
		style:width="{tableBar.cell.w}px"
		style:height="{tableBar.cell.h}px"
	></div>
{/if}

{#if tableBar}
	<div class="rt-pop table-bar" role="toolbar" aria-label="Tabelle" tabindex="-1" style:left="{tableBar.x}px" style:top="{tableBar.y}px" onmousedown={keepFocus}>
		{#each TABLE_ACTIONS as [action, label] (action)}
			<button
				onclick={() => {
					const root = editor;
					if (root) run(() => tableAction(root, action));
				}}>{label}</button
			>
		{/each}
		<button
			class:on={tableBar.header}
			aria-pressed={tableBar.header}
			title="Erste Zeile als farbige Kopfzeile"
			onclick={() => {
				const root = editor;
				if (root) run(() => tableAction(root, 'header'));
			}}>☰ Kopfzeile</button
		>
		<span class="drop">
			<button class:on={cellColorsOpen} onclick={() => (cellColorsOpen = !cellColorsOpen)}>Zellen färben</button>
			{#if cellColorsOpen}
				<span class="cell-colors">
					{#each CELL_COLORS as c (c.cls)}
						<button
							class="cell-swatch {c.cls}"
							title={c.name}
							aria-label="Zellen {c.name}"
							onclick={() => {
								cellColorsOpen = false;
								const root = editor;
								if (root) run(() => colorCells(root, c.cls));
							}}
						></button>
					{/each}
					<button
						class="cell-swatch none"
						title="Keine Farbe"
						aria-label="Zellfarbe entfernen"
						onclick={() => {
							cellColorsOpen = false;
							const root = editor;
							if (root) run(() => colorCells(root, ''));
						}}>✕</button
					>
				</span>
			{/if}
		</span>
		<button
			title="Tabelle löschen"
			onclick={() => {
				const root = editor;
				if (root) run(() => tableAction(root, 'delete'));
			}}>🗑 Tabelle</button
		>
	</div>
{/if}

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
	}

	.toolbar button {
		height: 30px;
		padding: 0 9px;
		border: 1px solid transparent;
		border-radius: 7px;
		background: transparent;
		color: var(--text);
		font-size: 13px;
		line-height: 1;
	}

	.toolbar button:hover:not(:disabled) {
		border-color: var(--border);
	}

	.toolbar button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.toolbar .sq {
		display: inline-grid;
		place-items: center;
		min-width: 30px;
		padding: 0 7px;
	}

	.toolbar button.on,
	.toolbar button.open {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}

	.baustein {
		color: var(--accent) !important;
	}

	.caret {
		margin-left: 2px;
		font-size: 10px;
		opacity: 0.8;
	}

	.sep {
		width: 1px;
		height: 22px;
		margin: 0 6px;
		background: var(--border);
	}

	.drop {
		position: relative;
		display: inline-flex;
	}

	/* --- Aufklappmenüs --- */
	.menu {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 240px;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		box-shadow: 0 10px 30px rgb(0 0 0 / 25%);
	}

	.menu .item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		height: auto;
		padding: 7px 10px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--text);
		font-size: 14px;
		text-align: left;
	}

	.menu .item:hover,
	.menu .item.on,
	.menu .item.open {
		background: var(--accent-soft);
	}

	.item-icon {
		display: inline-grid;
		place-items: center;
		width: 26px;
		flex-shrink: 0;
		color: var(--accent);
		font-size: 17px;
		font-weight: 700;
	}

	.item-icon.list-bullets {
		font-size: 22px;
	}

	.item-icon.list-steps {
		font-size: 22px;
		font-weight: 400;
	}

	.item-icon.list-check {
		font-size: 18px;
		font-weight: 400;
	}

	.item-icon.h4 {
		font-size: 14px;
	}

	.item-text {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}

	.item-text strong {
		font-size: 14px;
	}

	.item-text small {
		color: var(--muted);
		font-size: 11px;
	}

	.menu .item.plain {
		color: var(--muted);
		font-size: 13px;
	}

	.menu-sep {
		height: 1px;
		margin: 4px 0;
		background: var(--border);
	}

	.menu-head {
		margin: 2px 10px 4px;
		color: var(--muted);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.menu-foot {
		margin: 6px 10px 2px;
		color: var(--muted);
		font-size: 11px;
	}

	.colors {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 10px 6px;
	}

	.swatch {
		width: 22px;
		height: 22px;
		padding: 0;
		border: 2px solid var(--surface);
		border-radius: 50%;
		background: var(--swatch);
		box-shadow: 0 0 0 1px var(--border);
	}

	.swatch:hover {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.custom-color {
		display: inline-grid;
		width: 22px;
		height: 22px;
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

	/* Tabelle: Größe im Raster wählen */
	.grid-menu {
		min-width: 0;
		align-items: center;
		padding: 10px 12px 8px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(6, 18px);
		gap: 4px;
	}

	.grid .cell {
		width: 18px;
		height: 18px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
	}

	.grid .cell.on {
		border-color: var(--accent);
		background: var(--accent);
	}

	.grid-size {
		margin: 8px 0 0;
		color: var(--muted);
		font-size: 12px;
	}

	/* Bausteine */
	.blocks {
		width: 280px;
		gap: 0;
	}

	.menu .item.row {
		gap: 10px;
		padding: 6px 10px;
	}

	.row-icon {
		display: inline-grid;
		place-items: center;
		width: 22px;
		font-size: 15px;
	}

	.more {
		margin-left: auto;
		color: var(--muted);
		font-size: 11px;
	}

	.sub-items {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 2px 10px 6px 42px;
	}

	.menu .item.row.small {
		width: auto;
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 12px;
	}

	.floating {
		position: fixed;
		top: auto;
		left: auto;
	}

	.cell-mark {
		position: fixed;
		z-index: 5;
		box-sizing: border-box;
		border: 2px solid var(--accent);
		pointer-events: none;
	}

	/* Kleine Leiste unter einer Tabelle */
	.table-bar {
		position: fixed;
		z-index: 25;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 5px 6px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
	}

	.table-bar button {
		height: 28px;
		padding: 0 9px;
		border: 1px solid transparent;
		border-radius: 7px;
		background: transparent;
		color: var(--text);
		font-size: 13px;
		white-space: nowrap;
	}

	.table-bar button:hover {
		border-color: var(--border);
	}

	.table-bar button.on {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}

	.cell-colors {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 0;
		display: flex;
		gap: 6px;
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
	}

	.table-bar .cell-swatch {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 11px;
	}

	.cell-swatch.c-yellow {
		background: color-mix(in srgb, #f0b429 35%, var(--surface));
	}

	.cell-swatch.c-green {
		background: color-mix(in srgb, #2fb36d 35%, var(--surface));
	}

	.cell-swatch.c-blue {
		background: color-mix(in srgb, #4a7cf0 35%, var(--surface));
	}

	.cell-swatch.c-red {
		background: color-mix(in srgb, #e5484d 35%, var(--surface));
	}

	.cell-swatch.c-purple {
		background: color-mix(in srgb, #9061e8 35%, var(--surface));
	}
</style>
