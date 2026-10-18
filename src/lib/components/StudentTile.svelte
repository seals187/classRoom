<script>
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import Icon from './Icon.svelte';

	/**
	 * @type {{
	 *   student: import('#lib/server/db.js').Student,
	 *   kind?: 'self' | 'lesson',
	 *   editable?: boolean,
	 *   own?: boolean,
	 *   open?: boolean,
	 *   onopenchange?: (open: boolean) => void
	 * }}
	 */
	let { student, kind = 'self', editable = true, own = false, open = true, onopenchange } = $props();

	let editing = $state(false);
	let newGoal = $state('');

	const total = $derived(student.goals.length);
	const done = $derived(student.goals.filter((g) => g.done).length);
	const percent = $derived(total ? Math.round((done / total) * 100) : 0);
	const complete = $derived(total > 0 && done === total);
	// Beim Bearbeiten immer aufgeklappt.
	const expanded = $derived(open || editing);

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

<article class="tile" class:complete class:own class:collapsed={!expanded}>
	<header>
		<button class="summary" aria-expanded={expanded} onclick={toggleOpen}>
			<span class="chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
			<span class="name">{student.firstName} {student.lastName}</span>
			{#if own}<span class="badge">Du</span>{/if}
		</button>
		{#if editable}
			<button
				class="icon-btn edit"
				class:active={editing}
				aria-label="Ziele von {student.firstName} bearbeiten"
				aria-pressed={editing}
				onclick={toggleEditing}
			>
				<Icon name="pencil" size={14} />
			</button>
		{/if}
	</header>

	<div class="progress" role="img" aria-label="Fortschritt {done} von {total}">
		<div class="fill" style:width="{percent}%"></div>
		<span>{done}/{total}{#if total} · {percent} %{/if}</span>
	</div>

	{#if expanded}
		{#if total > 0}
			<ul>
				{#each student.goals as goal (goal.id)}
					<li class:done={goal.done}>
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
			<p class="hint">{editable ? 'Noch keine Ziele – über den Stift hinzufügen.' : 'Noch keine Ziele.'}</p>
		{/if}

		{#if editing}
			<form onsubmit={add}>
				<input type="text" bind:value={newGoal} placeholder="Neues Ziel…" maxlength="200" />
				<button type="submit" class="primary">+</button>
			</form>
		{/if}
	{/if}
</article>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px 12px;
		border: 2px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		box-shadow: var(--shadow);
		font-size: 0.9rem;
		transition:
			background 0.3s,
			border-color 0.3s;
	}

	.tile.own {
		border-color: var(--accent);
	}

	.tile.complete {
		border-color: var(--ok);
		background: var(--ok-soft);
	}

	header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* Ganze Kopfzeile ist der Auf-/Zuklapp-Knopf. */
	.summary {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
		border: 0;
		background: transparent;
		text-align: left;
		font-weight: 700;
		font-size: 1rem;
	}

	.summary:hover {
		color: var(--accent);
	}

	.chevron {
		width: 12px;
		flex-shrink: 0;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badge {
		flex-shrink: 0;
		padding: 1px 7px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 0.7rem;
		font-weight: 600;
	}

	.icon-btn.edit {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
	}

	.icon-btn.active {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}

	.progress {
		position: relative;
		height: 18px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--bg);
		border: 1px solid var(--border);
	}

	.progress .fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--accent);
		transition: width 0.3s;
	}

	.complete .progress .fill {
		background: var(--ok);
	}

	.progress span {
		position: relative;
		display: block;
		text-align: center;
		line-height: 16px;
		font-size: 0.72rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		mix-blend-mode: difference;
		color: #fff;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: 6px;
		background: var(--bg);
		line-height: 1.3;
		transition: background 0.2s;
	}

	li.done {
		background: var(--ok);
		color: var(--on-accent);
	}

	li label {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		cursor: pointer;
	}

	li label span {
		overflow-wrap: anywhere;
	}

	li label.readonly {
		cursor: default;
	}

	input[type='checkbox'] {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		margin: 0;
		accent-color: var(--ok);
	}

	input[type='checkbox']:disabled {
		opacity: 1;
	}

	.goal-text {
		flex: 1;
		min-width: 0;
		padding: 3px 6px;
		font-size: 0.9rem;
		color: var(--text);
	}

	/* Feste Farben, sonst erbt das ✕ in erledigten (grünen) Zeilen die helle Schrift und verschwindet. */
	li .icon-btn {
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		background: var(--surface);
		color: var(--text);
	}

	li .icon-btn:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	form {
		display: flex;
		gap: 6px;
	}

	form input {
		flex: 1;
		min-width: 0;
		padding: 5px 8px;
		font-size: 0.9rem;
	}

	form button {
		padding: 4px 12px;
	}
</style>
