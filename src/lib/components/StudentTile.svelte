<script>
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import Icon from './Icon.svelte';

	/**
	 * Kachel eines Schülers im Raster. Zugeklappt eine Rasterzeile hoch, aufgeklappt so viele
	 * Zeilen, wie die Ziele brauchen (grid-row: span N) – die anderen Kacheln rücken nach.
	 * @type {{
	 *   student: import('#lib/server/db.js').Student,
	 *   kind?: 'self' | 'lesson',
	 *   editable?: boolean,
	 *   own?: boolean,
	 *   open?: boolean,
	 *   onopenchange?: (open: boolean) => void,
	 *   now?: Date | null,
	 *   staleMinutes?: number,
	 *   row?: number,
	 *   gap?: number
	 * }}
	 */
	let {
		student,
		kind = 'self',
		editable = true,
		own = false,
		open = false,
		onopenchange,
		now = null,
		staleMinutes = 15,
		row = 56,
		gap = 10
	} = $props();

	let editing = $state(false);
	let newGoal = $state('');
	let contentHeight = $state(0);

	const total = $derived(student.goals.length);
	const done = $derived(student.goals.filter((g) => g.done).length);
	const percent = $derived(total ? (done / total) * 100 : 0);
	const complete = $derived(total > 0 && done === total);
	// Aktuelles Ziel = erstes noch nicht erledigtes.
	const current = $derived(student.goals.find((g) => !g.done) ?? null);
	const expanded = $derived(open || editing);
	const isSelf = $derived(kind === 'self');

	const minutes = $derived(
		now && student.activeAt !== null ? Math.max(0, Math.floor((now.getTime() - student.activeAt) / 60000)) : null
	);
	const stale = $derived(isSelf && !complete && total > 0 && minutes !== null && minutes >= staleMinutes);
	// Zugeklappt genau eine Rasterzeile; aufgeklappt so viele ganze Zeilen, wie der Inhalt (+ 2px Rahmen) braucht.
	const span = $derived(expanded ? Math.max(1, Math.ceil((contentHeight + 2 + gap) / (row + gap))) : 1);

	const shortName = $derived(`${student.firstName} ${student.lastName.charAt(0)}.`);

	/** @param {number} m */
	const since = (m) => (m < 60 ? `${m} min` : m < 24 * 60 ? `${Math.floor(m / 60)} h` : '> 1 Tag');

	/** @param {() => Promise<unknown>} action */
	async function run(action) {
		try {
			await action();
		} catch (err) {
			alert(err instanceof Error ? err.message : String(err));
		}
		await invalidateAll();
	}

	/** @param {import('#lib/server/db.js').Goal} goal */
	const toggle = (goal) => run(() => api(`/api/goals/${goal.id}`, 'PATCH', { done: !goal.done }));

	/** @param {import('#lib/server/db.js').Goal} goal */
	const remove = (goal) => run(() => api(`/api/goals/${goal.id}`, 'DELETE'));

	/**
	 * @param {import('#lib/server/db.js').Goal} goal
	 * @param {HTMLInputElement} input
	 */
	function rename(goal, input) {
		const text = input.value.trim();
		if (!text) input.value = goal.text;
		if (!text || text === goal.text) return;
		run(() => api(`/api/goals/${goal.id}`, 'PATCH', { text }));
	}

	/** @param {SubmitEvent} e */
	async function add(e) {
		e.preventDefault();
		const text = newGoal.trim();
		if (!text) return;
		newGoal = '';
		await run(() => api(`/api/students/${student.id}/goals`, 'POST', { text, kind }));
	}

	function toggleOpen() {
		if (editing) editing = false;
		onopenchange?.(!expanded);
	}

	function toggleEditing() {
		editing = !editing;
		if (editing) onopenchange?.(true);
	}
</script>

<article
	class="tile"
	class:complete
	class:expanded
	class:stale
	class:own
	style:grid-row-end="span {span}"
	title="{student.firstName} {student.lastName}"
>
	<div class="inner" bind:offsetHeight={contentHeight}>
		<button class="summary" aria-expanded={expanded} onclick={toggleOpen}>
			<span class="row1">
				<span class="chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
				<span class="name">{shortName}</span>
				{#if own}<span class="badge">Du</span>{/if}
				<span class="count">
					{#if complete}<Icon name="check" size={15} />{:else}{done}/{total}{/if}
				</span>
			</span>
			{#if isSelf}
				<span class="row2">
					{#if complete}
						<span class="ok">Alle Ziele erledigt</span>
					{:else if current}
						→ {current.text}{#if minutes !== null}<span class="mins">{` · ${since(minutes)}`}</span>{/if}
					{:else}
						<span class="none">Noch keine Ziele</span>
					{/if}
				</span>
			{/if}
		</button>

		<div class="bar" role="img" aria-label="Fortschritt {done} von {total}">
			<div class="fill" style:width="{percent}%"></div>
		</div>

		{#if expanded}
			<div class="details">
				{#if total > 0}
					<ul>
						{#each student.goals as goal (goal.id)}
							<li class:done={goal.done} class:current={isSelf && goal === current}>
								{#if editing}
									<input type="checkbox" checked={goal.done} onchange={() => toggle(goal)} aria-label="Erledigt" />
									<input
										type="text"
										class="goal-text"
										value={goal.text}
										maxlength="200"
										onchange={(e) => rename(goal, e.currentTarget)}
									/>
									<button class="icon-btn danger" aria-label="Ziel löschen" onclick={() => remove(goal)}>
										<Icon name="close" size={14} />
									</button>
								{:else}
									<label class:readonly={!editable}>
										<input type="checkbox" checked={goal.done} disabled={!editable} onchange={() => toggle(goal)} />
										<span>{goal.text}</span>
									</label>
								{/if}
							</li>
						{/each}
					</ul>
				{:else if !editing}
					<p class="hint">{editable ? 'Noch keine Ziele – über „Ziele bearbeiten“ hinzufügen.' : 'Noch keine Ziele.'}</p>
				{/if}

				{#if editing}
					<form onsubmit={add}>
						<input type="text" bind:value={newGoal} placeholder="Neues Ziel…" maxlength="200" />
						<button type="submit" class="primary">+</button>
					</form>
				{/if}

				{#if editable}
					<button class="edit" class:active={editing} aria-pressed={editing} onclick={toggleEditing}>
						<Icon name={editing ? 'check' : 'pencil'} size={13} />
						{editing ? 'Fertig' : 'Ziele bearbeiten'}
					</button>
				{/if}
			</div>
		{/if}
	</div>
</article>

<style>
	.tile {
		min-width: 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		transition:
			border-color 0.2s,
			background 0.3s;
	}

	.tile.own {
		border-color: var(--page-accent);
	}

	.tile.expanded {
		border-color: var(--page-accent);
	}

	.tile.stale {
		border-color: var(--warn);
	}

	.tile.complete {
		border-color: var(--ok);
		background: var(--ok-soft);
	}

	.inner {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px 11px;
	}

	.summary {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		text-align: left;
	}

	.row1 {
		line-height: 20px;
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.chevron {
		width: 10px;
		color: var(--muted);
		font-size: 11px;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-size: 15px;
		font-weight: 700;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.badge {
		padding: 0 6px;
		border-radius: 999px;
		background: var(--page-accent);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
	}

	.count {
		display: inline-flex;
		color: var(--muted);
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.complete .count {
		color: var(--ok);
	}

	.row2 {
		line-height: 16px;
		min-width: 0;
		overflow: hidden;
		padding-left: 16px;
		color: var(--text);
		font-size: 13px;
		white-space: nowrap;
		text-overflow: ellipsis;
		opacity: 0.85;
	}

	.mins,
	.none {
		color: var(--muted);
	}

	.stale .mins {
		color: var(--warn);
		font-weight: 600;
	}

	.ok {
		color: var(--ok);
	}

	.bar {
		height: 8px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--track);
	}

	.fill {
		height: 100%;
		border-radius: 999px;
		background: var(--page-accent);
		transition: width 0.3s;
	}

	.complete .fill {
		background: var(--ok);
	}

	.details {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		font-size: 14px;
	}

	label {
		display: flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
		cursor: pointer;
	}

	label.readonly {
		cursor: default;
	}

	label span {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	/* Eigene Checkbox: leerer Rahmen, erledigt grün mit Häkchen. */
	input[type='checkbox'] {
		appearance: none;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		margin: 0;
		border: 1.5px solid var(--muted);
		border-radius: 5px;
		background: transparent;
		cursor: pointer;
	}

	input[type='checkbox']:checked {
		border-color: var(--ok);
		background: var(--ok);
	}

	input[type='checkbox']:checked::after {
		content: '';
		width: 5px;
		height: 9px;
		margin-top: -2px;
		border: solid #fff;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	input[type='checkbox']:disabled {
		cursor: default;
	}

	li.done span {
		color: var(--muted);
		text-decoration: line-through;
	}

	li.current span {
		font-weight: 700;
	}

	li.current input[type='checkbox'] {
		border: 2px solid var(--page-accent);
	}

	.goal-text {
		flex: 1;
		min-width: 0;
		padding: 4px 6px;
		font-size: 13px;
	}

	form {
		display: flex;
		gap: 6px;
	}

	form input {
		flex: 1;
		min-width: 0;
		padding: 5px 8px;
		font-size: 13px;
	}

	form button {
		padding: 4px 10px;
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 13px;
	}

	.edit {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 4px;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
	}

	.edit:hover,
	.edit.active {
		color: var(--page-accent);
	}

	.icon-btn {
		width: 26px;
		height: 26px;
	}
</style>
