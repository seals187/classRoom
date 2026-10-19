<script>
	import { tick, untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { ask, showError } from '#lib/dialog.svelte.js';
	import Icon from './Icon.svelte';

	/**
	 * Fenster „Ziele aus dem Auftrag“: Schritte als Stunden- oder Selbstlern-Ziele an alle, eine Gruppe
	 * oder einzelne Schüler senden – Text anpassen, sortieren, ergänzen. Danach kurze Bestätigung mit „Rückgängig“.
	 * Gruppen lassen sich hier anlegen, bearbeiten und löschen; sie bleiben gespeichert.
	 * @type {{
	 *   open: boolean,
	 *   steps: string[],
	 *   title?: string,
	 *   students: { id: number, firstName: string, lastName: string }[],
	 *   groups?: import('#lib/server/groups.js').Group[]
	 * }}
	 */
	let { open = $bindable(false), steps, title = '', students, groups = [] } = $props();

	const KINDS = {
		lesson: { label: 'Stundenziele', one: 'Stundenziel', page: '/stundenziele' },
		self: { label: 'Selbstlern-Ziele', one: 'Selbstlern-Ziel', page: '/selbstlernen' }
	};

	// Gruppenfarben (Schlüssel wie in groups.js) und Farben für die Initialen der Schüler.
	const COLORS = { blue: '#4a7cf0', orange: '#f08a3c', purple: '#9061e8', green: '#23a26b', red: '#e5484d' };
	const AVATAR = ['#4a7cf0', '#f08a3c', '#9061e8', '#23a26b', '#e5484d', '#14a3b8', '#d9468f'];

	/** @type {'send' | 'form' | 'manage'} */
	let view = $state('send');
	/** @type {'lesson' | 'self'} */
	let kind = $state('lesson');
	/** @type {'all' | 'group' | 'pick'} */
	let target = $state('all');
	/** @type {number | null} */
	let groupId = $state(null);
	/** @type {number[]} */
	let pickedStudents = $state([]);
	/** @type {{ key: number, text: string, on: boolean }[]} */
	let rows = $state([]);
	let replace = $state(false);
	let busy = $state(false);
	let nextKey = 0;

	// Formular „Neue Gruppe“ / „Gruppe bearbeiten“
	/** @type {number | null} */
	let editId = $state(null);
	let groupName = $state('');
	let groupColor = $state('blue');
	/** @type {number[]} */
	let groupMembers = $state([]);
	/** Von wo das Formular geöffnet wurde – dorthin geht „Zurück“. @type {'send' | 'manage'} */
	let formFrom = $state('send');

	/** @type {{ what: string, students: number, kind: 'lesson' | 'self', goalIds: number[] } | null} */
	let toast = $state(null);
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let toastTimer;

	/** @type {HTMLDivElement | undefined} */
	let listEl = $state();

	// Feste Reihenfolge nach Vornamen (keine Sortier-Optionen).
	const sorted = $derived([...students].sort((a, b) => a.firstName.localeCompare(b.firstName, 'de')));
	const byId = $derived(new Map(students.map((s) => [s.id, s])));
	const goals = $derived(rows.filter((r) => r.on && r.text.trim()).map((r) => r.text.trim()));
	const group = $derived(groups.find((g) => g.id === groupId) ?? null);
	const recipientIds = $derived(
		target === 'all' ? null : target === 'group' ? (group?.studentIds.filter((id) => byId.has(id)) ?? []) : pickedStudents
	);
	const recipients = $derived(recipientIds === null ? students.length : recipientIds.length);
	const kindLabel = $derived(KINDS[kind].label);

	// Nur beim Öffnen mit den Schritten des Auftrags füllen. Die Startseite lädt alle 10 s neu –
	// ohne untrack würde das Fenster dabei jedes Mal zurückgesetzt (Ansicht, Auswahl, Texte).
	$effect(() => {
		if (!open) return;
		untrack(() => {
			rows = steps.map((text) => ({ key: nextKey++, text, on: true }));
			view = 'send';
			kind = 'lesson';
			target = 'all';
			groupId = null;
			pickedStudents = [];
			replace = false;
		});
	});

	/** @param {{ id: number, firstName: string, lastName: string }} s */
	const initials = (s) => `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase();
	/** @param {number} id */
	const avatarColor = (id) => AVATAR[id % AVATAR.length];
	/** @param {{ firstName: string, lastName: string }} s */
	const shortName = (s) => `${s.firstName} ${s.lastName.charAt(0)}.`;

	/** Mitglieder einer Gruppe nach Vornamen. @param {import('#lib/server/groups.js').Group} g */
	const membersOf = (g) => sorted.filter((s) => g.studentIds.includes(s.id));

	/** „3 Schüler · Anna, David, Gina“ – ab vier Namen mit „…“. @param {import('#lib/server/groups.js').Group} g */
	function groupSummary(g) {
		const list = membersOf(g);
		const names = list.slice(0, 3).map((s) => s.firstName).join(', ');
		return `${list.length} Schüler · ${names}${list.length > 3 ? ' …' : ''}`;
	}

	async function addRow() {
		rows.push({ key: nextKey++, text: '', on: true });
		await tick();
		listEl?.querySelector(`[data-key="${rows[rows.length - 1].key}"] input[type='text']`)?.focus();
	}

	/** @param {number} key */
	function removeRow(key) {
		rows = rows.filter((r) => r.key !== key);
	}

	// --- Sortieren per Ziehen am Griff ---
	/** @type {number | null} */
	let dragIndex = $state(null);

	/** @param {DragEvent} e @param {number} index */
	function onDragStart(e, index) {
		dragIndex = index;
		e.dataTransfer?.setData('text/plain', String(index));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	/** @param {DragEvent} e @param {number} index */
	function onDragOver(e, index) {
		if (dragIndex === null || dragIndex === index) return;
		e.preventDefault();
		const [row] = rows.splice(dragIndex, 1);
		rows.splice(index, 0, row);
		dragIndex = index;
	}

	/** @param {number[]} list @param {number} id */
	const toggle = (list, id) => (list.includes(id) ? list.filter((s) => s !== id) : [...list, id]);

	// --- Gruppen ---

	/** @param {import('#lib/server/groups.js').Group | null} g @param {'send' | 'manage'} from */
	function openForm(g, from) {
		editId = g?.id ?? null;
		groupName = g?.name ?? '';
		groupColor = g?.color ?? 'blue';
		groupMembers = g ? [...g.studentIds] : [];
		formFrom = from;
		view = 'form';
	}

	async function saveGroup() {
		busy = true;
		try {
			const body = { name: groupName, color: groupColor, studentIds: groupMembers };
			const saved = editId === null ? await api('/api/groups', 'POST', body) : await api(`/api/groups/${editId}`, 'PUT', body);
			await invalidateAll();
			if (formFrom === 'send') {
				target = 'group';
				groupId = saved.id;
			}
			view = formFrom;
		} catch (err) {
			showError(err);
		} finally {
			busy = false;
		}
	}

	/** @param {import('#lib/server/groups.js').Group} g */
	async function removeGroup(g) {
		const ok = await ask({
			title: `Gruppe „${g.name}“ löschen?`,
			message: 'Die Schüler und ihre Ziele bleiben erhalten.',
			confirmLabel: 'Löschen',
			danger: true
		});
		if (!ok) return;
		try {
			await api(`/api/groups/${g.id}`, 'DELETE');
			if (groupId === g.id) groupId = null;
			await invalidateAll();
		} catch (err) {
			showError(err);
		}
	}

	// --- Senden ---

	async function send() {
		busy = true;
		try {
			const result = await api('/api/goals', 'POST', {
				kind,
				texts: goals,
				replace,
				studentIds: recipientIds ?? undefined
			});
			open = false;
			const n = goals.length;
			showToast({
				what: `${n} ${n === 1 ? KINDS[kind].one : kindLabel}`,
				students: result.students,
				kind,
				// Nach „ersetzen“ lässt sich das Alte nicht wiederherstellen – dann kein Rückgängig.
				goalIds: replace ? [] : result.goalIds
			});
			await invalidateAll();
		} catch (err) {
			showError(err);
		} finally {
			busy = false;
		}
	}

	/** @param {NonNullable<typeof toast>} next */
	function showToast(next) {
		toast = next;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 10000);
	}

	async function undo() {
		if (!toast) return;
		const ids = toast.goalIds;
		toast = null;
		try {
			await api('/api/goals', 'DELETE', { ids });
			await invalidateAll();
		} catch (err) {
			showError(err);
		}
	}
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#snippet avatar(/** @type {{ id: number, firstName: string, lastName: string }} */ s)}
	<span class="avatar" style:background={avatarColor(s.id)} aria-hidden="true">{initials(s)}</span>
{/snippet}

{#snippet groupCard(/** @type {import('#lib/server/groups.js').Group} */ g)}
	<span class="dot" style:background={COLORS[/** @type {keyof typeof COLORS} */ (g.color)] ?? COLORS.blue}></span>
	<span class="g-text">
		<strong>{g.name}</strong>
		<small>{groupSummary(g)}</small>
	</span>
	<span class="stack">
		{#each membersOf(g).slice(0, 4) as s (s.id)}{@render avatar(s)}{/each}
	</span>
{/snippet}

{#if open}
	<div class="dialog">
		<button class="backdrop" tabindex="-1" aria-label="Schließen" onclick={() => (open = false)}></button>
		<div class="panel" role="dialog" aria-modal="true" aria-labelledby="gfa-title">
			{#if view === 'send'}
				<div class="head">
					<div>
						<h2 id="gfa-title">Ziele aus dem Auftrag</h2>
						<p class="sub">{title ? `${title} · ` : ''}{goals.length} {goals.length === 1 ? 'Ziel' : 'Ziele'}</p>
					</div>
					<button class="icon-btn" aria-label="Schließen" onclick={() => (open = false)}><Icon name="close" size={16} /></button>
				</div>

				<div class="body">
				<div class="section">
					<span class="caption">Anlegen als</span>
					<div class="segments" role="radiogroup" aria-label="Anlegen als">
						<button role="radio" aria-checked={kind === 'lesson'} class:active={kind === 'lesson'} onclick={() => (kind = 'lesson')}>
							<Icon name="target" size={15} /> Stundenziele
						</button>
						<button role="radio" aria-checked={kind === 'self'} class:active={kind === 'self'} onclick={() => (kind = 'self')}>
							<Icon name="book" size={15} /> Selbstlern-Ziele
						</button>
					</div>
				</div>

				<div class="section">
					<span class="caption">Für wen?</span>
					<div class="segments three" role="radiogroup" aria-label="Für wen?">
						<button role="radio" aria-checked={target === 'all'} class:active={target === 'all'} onclick={() => (target = 'all')}>
							Alle ({students.length})
						</button>
						<button role="radio" aria-checked={target === 'group'} class:active={target === 'group'} onclick={() => (target = 'group')}>
							<Icon name="users" size={15} /> Gruppe
						</button>
						<button role="radio" aria-checked={target === 'pick'} class:active={target === 'pick'} onclick={() => (target = 'pick')}>
							Einzelne{target === 'pick' && pickedStudents.length ? ` (${pickedStudents.length})` : ''}
						</button>
					</div>
				</div>

				{#if target === 'group'}
					<div class="section">
						<span class="caption">Gruppe wählen</span>
						{#if groups.length}
							<div class="groups" role="radiogroup" aria-label="Gruppe">
								{#each groups as g (g.id)}
									<button class="group-card" role="radio" aria-checked={groupId === g.id} class:on={groupId === g.id} onclick={() => (groupId = g.id)}>
										{@render groupCard(g)}
										<span class="tick">{#if groupId === g.id}<Icon name="check" size={16} />{/if}</span>
									</button>
								{/each}
							</div>
						{:else}
							<p class="empty">Noch keine Gruppen – lege die erste an.</p>
						{/if}
						<div class="links">
							<button class="add" onclick={() => openForm(null, 'send')}>+ Neue Gruppe</button>
							{#if groups.length}
								<button class="more" onclick={() => (view = 'manage')}>Gruppen verwalten <Icon name="chevron" size={14} /></button>
							{/if}
						</div>
					</div>
				{:else if target === 'pick'}
					<div class="section">
						<span class="caption">Schüler auswählen · {pickedStudents.length} gewählt</span>
						<div class="chips">
							{#each sorted as s (s.id)}
								<button class="chip" class:on={pickedStudents.includes(s.id)} aria-pressed={pickedStudents.includes(s.id)} onclick={() => (pickedStudents = toggle(pickedStudents, s.id))}>
									{@render avatar(s)}
									{shortName(s)}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<div class="section">
					<span class="caption">Ziele · Text anpassen, ziehen zum Sortieren</span>
					<div class="rows" bind:this={listEl}>
						{#each rows as row, i (row.key)}
							<div
								class="row"
								class:dragging={dragIndex === i}
								data-key={row.key}
								role="listitem"
								ondragover={(e) => onDragOver(e, i)}
								ondrop={(e) => e.preventDefault()}
							>
								<span
									class="handle"
									draggable="true"
									role="button"
									tabindex="-1"
									aria-label="Ziehen zum Sortieren"
									ondragstart={(e) => onDragStart(e, i)}
									ondragend={() => (dragIndex = null)}>⋮⋮</span
								>
								<input type="checkbox" bind:checked={row.on} aria-label="Ziel übernehmen" />
								<input type="text" bind:value={row.text} maxlength="200" class:off={!row.on} placeholder="Neues Ziel" />
								<button class="x" aria-label="Ziel entfernen" title="Entfernen" onclick={() => removeRow(row.key)}><Icon name="close" size={14} /></button>
							</div>
						{/each}
					</div>
					<button class="add indent" onclick={addRow}>+ Weiteres Ziel</button>
				</div>

				</div>

				<div class="foot">
					<label class="switch" title="Bestehende {kindLabel} der Empfänger werden gelöscht">
						<input type="checkbox" role="switch" bind:checked={replace} />
						Bestehende Ziele ersetzen
					</label>
					<button onclick={() => (open = false)} disabled={busy}>Abbrechen</button>
					<button class="primary" onclick={send} disabled={busy || goals.length === 0 || recipients === 0}>
						{#if target === 'group'}
							{group ? `An ${group.name} senden` : 'Gruppe wählen'}
						{:else}
							{goals.length} {goals.length === 1 ? 'Ziel' : 'Ziele'} an {recipients} Schüler
						{/if}
					</button>
				</div>
			{:else if view === 'form'}
				<div class="head">
					<div class="title-row">
						<button class="icon-btn back" aria-label="Zurück" onclick={() => (view = formFrom)}><Icon name="back" size={16} /></button>
						<h2 id="gfa-title">{editId === null ? 'Neue Gruppe' : 'Gruppe bearbeiten'}</h2>
					</div>
				</div>

				<div class="body">
				<label class="section">
					<span class="caption">Name</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input type="text" class="name" bind:value={groupName} maxlength="60" placeholder="z. B. Förderkinder" autofocus />
				</label>

				<div class="section">
					<span class="caption">Farbe</span>
					<div class="swatches" role="radiogroup" aria-label="Farbe">
						{#each Object.entries(COLORS) as [key, value] (key)}
							<button
								class="swatch"
								class:on={groupColor === key}
								role="radio"
								aria-checked={groupColor === key}
								aria-label={key}
								style:--swatch={value}
								onclick={() => (groupColor = key)}
							></button>
						{/each}
					</div>
				</div>

				<div class="section">
					<span class="caption">Schüler auswählen · {groupMembers.length} gewählt</span>
					<div class="chips tall">
						{#each sorted as s (s.id)}
							<button class="chip" class:on={groupMembers.includes(s.id)} aria-pressed={groupMembers.includes(s.id)} onclick={() => (groupMembers = toggle(groupMembers, s.id))}>
								{@render avatar(s)}
								{shortName(s)}
							</button>
						{/each}
					</div>
					<p class="note">Gruppe bleibt gespeichert und ist beim nächsten Mal wieder auswählbar</p>
				</div>
				</div>

				<div class="foot">
					<span class="spacer"></span>
					<button onclick={() => (view = formFrom)} disabled={busy}>Abbrechen</button>
					<button class="primary" onclick={saveGroup} disabled={busy || !groupName.trim() || groupMembers.length === 0}>Gruppe speichern</button>
				</div>
			{:else}
				<div class="head">
					<div class="title-row">
						<button class="icon-btn back" aria-label="Zurück" onclick={() => (view = 'send')}><Icon name="back" size={16} /></button>
						<h2 id="gfa-title">Gruppen verwalten</h2>
					</div>
				</div>

				<div class="body groups">
					{#each groups as g (g.id)}
						<div class="group-card static">
							{@render groupCard(g)}
							<button class="icon-btn small" title="Bearbeiten" aria-label="{g.name} bearbeiten" onclick={() => openForm(g, 'manage')}>
								<Icon name="pencil" size={14} />
							</button>
							<button class="icon-btn small danger" title="Löschen" aria-label="{g.name} löschen" onclick={() => removeGroup(g)}>
								<Icon name="close" size={14} />
							</button>
						</div>
					{:else}
						<p class="empty">Noch keine Gruppen.</p>
					{/each}
				</div>

				<div class="foot">
					<button class="add" onclick={() => openForm(null, 'manage')}>+ Neue Gruppe</button>
					<span class="spacer"></span>
					<button class="primary" onclick={() => (view = 'send')}>Fertig</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if toast}
	<div class="toast" role="status">
		<Icon name="check" size={16} />
		<span><strong>{toast.what}</strong> an {toast.students} Schüler gesendet</span>
		{#if toast.goalIds.length}<button class="toast-link" onclick={undo}>Rückgängig</button>{/if}
		<a class="toast-link" href={KINDS[toast.kind].page} onclick={() => (toast = null)}>{KINDS[toast.kind].label} öffnen →</a>
	</div>
{/if}

<style>
	.dialog {
		position: fixed;
		inset: 0;
		z-index: 25;
		display: grid;
		place-items: center;
		padding: 16px;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: rgb(10 15 30 / 50%);
		cursor: default;
	}

	/* Feste Größe – springt nicht beim Wechsel zwischen Ziele, Gruppe, Einzelne, Neue Gruppe.
	   Längerer Inhalt scrollt im Fenster, die Knöpfe stehen immer unten. */
	.panel {
		position: relative;
		width: min(580px, 100%);
		height: min(620px, calc(100dvh - 32px));
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px 20px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		box-shadow: 0 20px 60px rgb(10 15 30 / 35%);
	}

	/* Mittelteil scrollt, Kopf und Knöpfe bleiben stehen. */
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin: 0 -20px;
		padding: 2px 20px;
	}

	.body.groups {
		gap: 8px;
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	h2 {
		margin: 0;
		font-size: 19px;
	}

	.sub {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 13px;
	}

	.icon-btn {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border-radius: 9px;
	}

	.icon-btn.small {
		width: 28px;
		height: 28px;
		border-color: transparent;
		background: transparent;
		color: var(--muted);
	}

	.icon-btn.small:hover {
		color: var(--text);
	}

	.icon-btn.danger:hover {
		color: var(--danger);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.caption {
		color: var(--muted);
		font-size: 13px;
	}

	/* Reiter: dunkle Leiste, gewählter Reiter heller hervorgehoben – einfarbig, Symbole in Textfarbe. */
	.segments {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg);
	}

	.segments.three {
		grid-template-columns: repeat(3, 1fr);
	}

	.segments button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 7px 8px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		font-size: 14px;
		font-weight: 600;
	}

	.segments button:hover:not(.active) {
		color: var(--text);
	}

	.segments button.active {
		background: color-mix(in srgb, var(--text) 9%, var(--surface));
		color: var(--text);
		box-shadow: 0 1px 2px rgb(0 0 0 / 18%);
	}

	/* Initialen im Kreis */
	.avatar {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		color: #fff;
		font-size: 8.5px;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	/* Gruppen als Karten: Farbpunkt, Name, Mitglieder, Initialen gestapelt */
	.groups {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.group-card {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: transparent;
		color: var(--text);
		text-align: left;
		font-weight: 400;
	}

	.group-card.on {
		border-color: var(--accent);
		background: var(--accent-soft);
		box-shadow: 0 0 0 1px var(--accent);
	}

	.group-card.static {
		padding-right: 8px;
	}

	.dot {
		flex-shrink: 0;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.g-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}

	.g-text strong {
		font-size: 15px;
	}

	.g-text small {
		overflow: hidden;
		color: var(--muted);
		font-size: 12.5px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stack {
		display: flex;
	}

	.stack .avatar {
		width: 26px;
		height: 26px;
		margin-left: -6px;
		border: 2px solid var(--surface);
		font-size: 9.5px;
	}

	.tick {
		display: grid;
		place-items: center;
		width: 18px;
		color: var(--accent);
	}

	.links {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.add {
		align-self: flex-start;
		padding: 2px 0;
		border: 0;
		background: transparent;
		color: var(--accent);
		font-size: 13px;
		font-weight: 600;
	}

	.add.indent {
		padding-left: 22px;
	}

	.more {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 13px;
	}

	.more:hover {
		color: var(--text);
	}

	.empty {
		margin: 0;
		color: var(--muted);
		font-size: 14px;
	}

	/* Schüler als Chips mit Initialen */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		max-height: 132px;
		overflow-y: auto;
		padding: 2px;
	}

	.chips.tall {
		max-height: 220px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px 3px 4px;
		border-radius: 999px;
		background: transparent;
		color: var(--text);
		font-size: 13px;
	}

	.chip.on {
		border-color: var(--accent);
		background: var(--accent-soft);
		box-shadow: 0 0 0 1px var(--accent);
		font-weight: 600;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		border-radius: 8px;
	}

	.row.dragging {
		opacity: 0.5;
	}

	.handle {
		flex-shrink: 0;
		width: 14px;
		color: var(--muted);
		font-size: 14px;
		letter-spacing: -3px;
		cursor: grab;
		user-select: none;
	}

	.row input[type='checkbox'] {
		flex-shrink: 0;
		width: 17px;
		height: 17px;
		margin: 0;
		accent-color: var(--accent);
	}

	.row input[type='text'] {
		flex: 1;
		min-width: 0;
		padding: 7px 10px;
		font-size: 14px;
	}

	.row input.off {
		opacity: 0.5;
		text-decoration: line-through;
	}

	.x {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
	}

	.x:hover {
		color: var(--danger);
	}

	/* Gruppe: Name, Farben */
	.name {
		padding: 8px 12px;
		font-size: 15px;
	}

	.swatches {
		display: flex;
		gap: 10px;
	}

	.swatch {
		width: 26px;
		height: 26px;
		padding: 0;
		border: 2px solid var(--surface);
		border-radius: 50%;
		background: var(--swatch);
		box-shadow: 0 0 0 1px var(--border);
	}

	.swatch.on {
		box-shadow: 0 0 0 2px var(--text);
	}

	.note {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 12px;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: auto;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.foot button:not(.add) {
		padding: 7px 14px;
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
	}

	.spacer {
		margin-right: auto;
	}

	/* Kippschalter „Bestehende Ziele ersetzen“ */
	.switch {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-right: auto;
		color: var(--muted);
		font-size: 12.5px;
		white-space: nowrap;
		cursor: pointer;
	}

	.switch input {
		appearance: none;
		position: relative;
		flex-shrink: 0;
		width: 32px;
		height: 18px;
		margin: 0;
		border-radius: 999px;
		background: var(--track);
		box-shadow: inset 0 0 0 1px var(--border);
		cursor: pointer;
		transition: background 0.2s;
	}

	.switch input::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 2px rgb(0 0 0 / 30%);
		transition: transform 0.2s;
	}

	.switch input:checked {
		background: var(--danger);
		box-shadow: none;
	}

	.switch input:checked::after {
		transform: translateX(14px);
	}

	.switch:has(input:checked) {
		color: var(--danger);
		font-weight: 600;
	}

	/* Kurze Bestätigung unten rechts */
	.toast {
		position: fixed;
		right: 24px;
		bottom: 24px;
		z-index: 24;
		display: flex;
		align-items: center;
		gap: 14px;
		max-width: calc(100vw - 32px);
		padding: 12px 18px;
		border: 1px solid color-mix(in srgb, var(--ok) 45%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--ok-soft) 85%, var(--surface));
		box-shadow: 0 10px 30px rgb(10 15 30 / 25%);
		color: var(--text);
		font-size: 14px;
		animation: rise 0.2s ease-out;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	.toast :global(svg) {
		flex-shrink: 0;
		color: var(--ok);
	}

	.toast-link {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ok);
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}

	.toast-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 640px) {
		.foot {
			flex-wrap: wrap;
		}

		.switch {
			flex-basis: 100%;
		}

		.stack {
			display: none;
		}

		.toast {
			left: 16px;
			right: 16px;
			bottom: 16px;
			flex-wrap: wrap;
		}
	}
</style>
