<script>
	import { tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { showError } from '#lib/dialog.svelte.js';
	import Icon from './Icon.svelte';

	/**
	 * Fenster „Ziele aus dem Auftrag“: Schritte als Stunden- oder Selbstlern-Ziele an alle oder
	 * einzelne Schüler senden – Text anpassen, sortieren, ergänzen. Danach kurze Bestätigung mit „Rückgängig“.
	 * @type {{
	 *   open: boolean,
	 *   steps: string[],
	 *   students: { id: number, firstName: string, lastName: string }[]
	 * }}
	 */
	let { open = $bindable(false), steps, students } = $props();

	const KINDS = {
		lesson: { label: 'Stundenziele', one: 'Stundenziel', page: '/stundenziele' },
		self: { label: 'Selbstlern-Ziele', one: 'Selbstlern-Ziel', page: '/selbstlernen' }
	};

	/** @type {'lesson' | 'self'} */
	let kind = $state('lesson');
	/** @type {'all' | 'pick'} */
	let target = $state('all');
	/** @type {number[]} */
	let pickedStudents = $state([]);
	/** @type {{ key: number, text: string, on: boolean }[]} */
	let rows = $state([]);
	let replace = $state(false);
	let busy = $state(false);
	let nextKey = 0;

	/** @type {{ what: string, students: number, kind: 'lesson' | 'self', goalIds: number[] } | null} */
	let toast = $state(null);
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let toastTimer;

	/** @type {HTMLDivElement | undefined} */
	let listEl = $state();

	const sorted = $derived([...students].sort((a, b) => a.firstName.localeCompare(b.firstName, 'de')));
	const goals = $derived(rows.filter((r) => r.on && r.text.trim()).map((r) => r.text.trim()));
	const recipients = $derived(target === 'all' ? students.length : pickedStudents.length);
	const kindLabel = $derived(KINDS[kind].label);

	// Beim Öffnen mit den Schritten des Auftrags füllen.
	$effect(() => {
		if (!open) return;
		rows = steps.map((text) => ({ key: nextKey++, text, on: true }));
		kind = 'lesson';
		target = 'all';
		pickedStudents = [];
		replace = false;
	});

	async function addRow() {
		rows.push({ key: nextKey++, text: '', on: true });
		await tick();
		listEl?.querySelector(`[data-key="${rows[rows.length - 1].key}"] input[type='text']`)?.focus();
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

	/** @param {number} id */
	function toggleStudent(id) {
		pickedStudents = pickedStudents.includes(id) ? pickedStudents.filter((s) => s !== id) : [...pickedStudents, id];
	}

	async function send() {
		busy = true;
		try {
			const result = await api('/api/goals', 'POST', {
				kind,
				texts: goals,
				replace,
				studentIds: target === 'pick' ? pickedStudents : undefined
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

{#if open}
	<div class="dialog">
		<button class="backdrop" tabindex="-1" aria-label="Schließen" onclick={() => (open = false)}></button>
		<div class="panel" role="dialog" aria-modal="true" aria-labelledby="gfa-title">
			<div class="head">
				<h2 id="gfa-title">Ziele aus dem Auftrag</h2>
				<button class="icon-btn" aria-label="Schließen" onclick={() => (open = false)}><Icon name="close" size={18} /></button>
			</div>

			<div class="group">
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

			<div class="group">
				<span class="caption">Für</span>
				<div class="segments three" role="radiogroup" aria-label="Für">
					<button role="radio" aria-checked={target === 'all'} class:active={target === 'all'} onclick={() => (target = 'all')}>
						Alle {students.length} Schüler
					</button>
					<button role="radio" aria-checked="false" disabled title="Gruppen gibt es noch nicht">Gruppe…</button>
					<button role="radio" aria-checked={target === 'pick'} class:active={target === 'pick'} onclick={() => (target = 'pick')}>
						{target === 'pick' && pickedStudents.length ? `${pickedStudents.length} ausgewählt` : 'Einzelne…'}
					</button>
				</div>
				{#if target === 'pick'}
					<div class="students">
						{#each sorted as s (s.id)}
							<button class="chip" class:on={pickedStudents.includes(s.id)} aria-pressed={pickedStudents.includes(s.id)} onclick={() => toggleStudent(s.id)}>
								{s.firstName} {s.lastName.charAt(0)}.
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="group">
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
						</div>
					{/each}
				</div>
				<button class="add" onclick={addRow}>+ Weiteres Ziel</button>
			</div>

			<div class="foot">
				<button class="replace" class:on={replace} onclick={() => (replace = !replace)} title="Klicken zum Umschalten">
					{replace ? `Bestehende ${kindLabel} werden ersetzt` : `Bestehende ${kindLabel} bleiben`}
				</button>
				<button onclick={() => (open = false)} disabled={busy}>Abbrechen</button>
				<button class="primary" onclick={send} disabled={busy || goals.length === 0 || recipients === 0}>
					{goals.length} {goals.length === 1 ? 'Ziel' : 'Ziele'} an {recipients} Schüler
				</button>
			</div>
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

	.panel {
		position: relative;
		width: min(580px, 100%);
		max-height: calc(100dvh - 32px);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px 20px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		box-shadow: 0 20px 60px rgb(10 15 30 / 35%);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		font-size: 19px;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.caption {
		color: var(--muted);
		font-size: 13px;
	}

	/* Segment-Umschalter */
	.segments {
		display: grid;
		grid-template-columns: 1fr 1fr;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.segments.three {
		grid-template-columns: 1.2fr 1fr 1fr;
	}

	.segments button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 7px 8px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		font-size: 14px;
		font-weight: 600;
	}

	.segments button.active {
		background: var(--bg);
		color: var(--text);
		box-shadow: 0 1px 2px rgb(0 0 0 / 15%);
	}

	.segments button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.students {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		max-height: 132px;
		overflow-y: auto;
		padding: 2px;
	}

	.chip {
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 13px;
		color: var(--muted);
	}

	.chip.on {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
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

	.add {
		align-self: flex-start;
		padding: 2px 0 2px 22px;
		border: 0;
		background: transparent;
		color: var(--accent);
		font-size: 13px;
		font-weight: 600;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.foot button {
		padding: 8px 14px;
		font-weight: 600;
		white-space: nowrap;
	}

	/* Hinweis links – Klick schaltet „ersetzen“ um */
	.foot .replace {
		margin-right: auto;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
		font-weight: 400;
		white-space: normal;
		text-align: left;
	}

	.foot .replace.on {
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

		.foot .replace {
			flex-basis: 100%;
		}

		.toast {
			left: 16px;
			right: 16px;
			bottom: 16px;
			flex-wrap: wrap;
		}
	}
</style>
