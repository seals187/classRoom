<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/api.js';
	import { dateLabel } from '#lib/assignments.js';
	import { showError } from '#lib/dialog.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { onMount } from 'svelte';

	// Alle Aufträge als Karten: Filter nach Klasse, Entwurf, Archiv; „Zeigen“ macht einen am Beamer aktiv.
	let { data } = $props();

	const classes = $derived(/** @type {{ id: number, name: string, color: string }[]} */ (page.data.classes ?? []));
	const classById = $derived(new Map(classes.map((c) => [c.id, c])));

	/** @type {'all' | 'drafts' | 'archive' | number} */
	let filter = $state('all');
	const FILTER_KEY = 'assignmentFilter';
	onMount(() => {
		try {
			const stored = localStorage.getItem(FILTER_KEY);
			if (stored === 'drafts' || stored === 'archive') filter = stored;
			else if (stored && classes.some((c) => c.id === Number(stored))) filter = Number(stored);
		} catch {
			// Kein localStorage – „Alle“.
		}
	});

	/** @param {typeof filter} value */
	function choose(value) {
		filter = value;
		try {
			localStorage.setItem(FILTER_KEY, String(value));
		} catch {
			// Gilt dann nur bis zum Neuladen.
		}
	}

	const shown = $derived(
		data.assignments.filter((a) => {
			if (filter === 'archive') return a.archived;
			if (a.archived) return false;
			if (filter === 'drafts') return a.draft;
			if (typeof filter === 'number') return a.classIds.includes(filter);
			return true;
		})
	);

	// Mitternacht: „Morgen“ wird zu „Heute“.
	const today = $derived(clock.now ?? new Date());

	/** @param {import('#lib/server/assignment.js').Assignment} a */
	function status(a) {
		if (a.archived) return 'Archiviert';
		const when = dateLabel(a.date, today);
		if (a.active) return when ? `${when} · aktiv` : 'aktiv';
		return when || (a.draft ? 'Entwurf' : '');
	}

	/** @param {import('#lib/server/assignment.js').Assignment} a */
	function summary(a) {
		const steps = a.steps;
		const parts = [`${steps} ${steps === 1 ? 'Schritt' : 'Schritte'}`];
		if (a.images.length) parts.push(`${a.images.length} ${a.images.length === 1 ? 'Bild' : 'Bilder'}`);
		return parts.join(' · ');
	}

	let busy = $state(0);

	/** @param {number} id */
	async function show(id) {
		busy = id;
		try {
			await api(`/api/assignments/${id}/show`, 'POST');
			await goto('/', { invalidateAll: true });
		} catch (err) {
			showError(err);
		} finally {
			busy = 0;
		}
	}

	/** @param {number} id */
	async function copy(id) {
		busy = id;
		try {
			await api(`/api/assignments/${id}/copy`, 'POST');
			await invalidateAll();
		} catch (err) {
			showError(err);
		} finally {
			busy = 0;
		}
	}

	/** @param {number} id */
	async function restore(id) {
		busy = id;
		try {
			await api(`/api/assignments/${id}`, 'PUT', { archived: false });
			await invalidateAll();
		} catch (err) {
			showError(err);
		} finally {
			busy = 0;
		}
	}
</script>

<svelte:head>
	<title>Aufträge · classRoom</title>
</svelte:head>

<div class="overview">
	<div class="head">
		<h1>Aufträge</h1>
		<div class="filters" role="radiogroup" aria-label="Filter">
			<button role="radio" aria-checked={filter === 'all'} class:on={filter === 'all'} onclick={() => choose('all')}>Alle</button>
			{#each classes as c (c.id)}
				<button role="radio" aria-checked={filter === c.id} class:on={filter === c.id} onclick={() => choose(c.id)}>{c.name}</button>
			{/each}
			<button role="radio" aria-checked={filter === 'drafts'} class:on={filter === 'drafts'} onclick={() => choose('drafts')}>
				Entwürfe
			</button>
			<button role="radio" aria-checked={filter === 'archive'} class:on={filter === 'archive'} onclick={() => choose('archive')}>
				Archiv
			</button>
		</div>
		<a class="new" href="/auftraege/neu">+ Neuer Auftrag</a>
	</div>

	<div class="grid">
		{#each shown as a (a.id)}
			<article class="card" class:active={a.active}>
				<div class="top">
					<span class="classes">
						{#each a.classIds as id (id)}
							{@const c = classById.get(id)}
							{#if c}<span class="class"><span class="dot" style:background={c.color}></span>{c.name}</span>{/if}
						{:else}
							<span class="class none">Ohne Klasse</span>
						{/each}
					</span>
					<span class="status">{status(a)}</span>
				</div>
				<a class="title" href="/auftraege/{a.id}">{a.title || 'Ohne Titel'}</a>
				<span class="summary">{summary(a)}</span>
				<div class="actions">
					{#if a.archived}
						<button class="main-btn" onclick={() => restore(a.id)} disabled={busy === a.id}>Aus dem Archiv holen</button>
					{:else if a.active}
						<span class="main-btn shown"><span class="live" aria-hidden="true"></span>Wird gezeigt</span>
					{:else}
						<button class="main-btn primary" onclick={() => show(a.id)} disabled={busy === a.id}>▶ Zeigen</button>
					{/if}
					<a class="icon" href="/auftraege/{a.id}?edit" title="Bearbeiten" aria-label="Bearbeiten">✎</a>
					<button class="icon" onclick={() => copy(a.id)} disabled={busy === a.id} title="Kopieren" aria-label="Kopieren">⧉</button>
				</div>
			</article>
		{/each}
		{#if filter !== 'archive'}
			<a class="card add" href="/auftraege/neu"><span aria-hidden="true">+</span>Neuer Auftrag</a>
		{:else if shown.length === 0}
			<p class="empty">Im Archiv ist nichts.</p>
		{/if}
	</div>
</div>

<style>
	.overview {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	h1 {
		margin: 0;
		font-size: 1.35rem;
	}

	.filters {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.filters button {
		padding: 4px 11px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font-size: 13px;
	}

	.filters button.on {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
	}

	.new {
		flex-shrink: 0;
		padding: 8px 16px;
		border-radius: 10px;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
		text-decoration: none;
	}

	.new:hover,
	.primary:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		padding: 12px 12px 12px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.card.active {
		border: 2px solid var(--ok);
		padding: 11px 11px 11px 13px;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}

	.classes {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 2px 10px;
		color: var(--muted);
	}

	.class {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}

	.class.none {
		font-style: italic;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status {
		flex-shrink: 0;
		color: var(--muted);
	}

	.active .status {
		color: var(--ok);
		font-weight: 600;
	}

	.title {
		overflow: hidden;
		margin-top: 2px;
		color: var(--text);
		font-size: 16px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.title:hover {
		color: var(--accent);
	}

	.summary {
		color: var(--muted);
		font-size: 12px;
	}

	.actions {
		display: flex;
		gap: 6px;
		margin-top: 10px;
	}

	.main-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 30px;
		padding: 4px 10px;
		border-radius: 7px;
		font-size: 13px;
		font-weight: 600;
	}

	.main-btn.primary {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}

	.main-btn.shown {
		background: var(--ok-soft);
		color: var(--ok);
	}

	.live {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ok);
	}

	.icon {
		display: inline-grid;
		place-items: center;
		width: 30px;
		height: 30px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: transparent;
		color: var(--muted);
		font-size: 13px;
		text-decoration: none;
	}

	.icon:hover:not(:disabled) {
		border-color: var(--muted);
		color: var(--text);
	}

	.card.add {
		align-items: center;
		justify-content: center;
		min-height: 116px;
		border: 1px dashed var(--border);
		background: transparent;
		box-shadow: none;
		color: var(--muted);
		font-size: 13px;
		text-decoration: none;
	}

	.card.add span {
		font-size: 22px;
		line-height: 1;
	}

	.card.add:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.empty {
		color: var(--muted);
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.head {
			flex-wrap: wrap;
		}

		.filters {
			order: 3;
			flex-basis: 100%;
		}

		h1 {
			flex: 1;
		}

		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
