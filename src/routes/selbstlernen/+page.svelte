<script>
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { showError } from '#lib/dialog.svelte.js';
	import GoalBoard from '#lib/components/GoalBoard.svelte';

	let { data } = $props();

	const isTeacher = $derived(data.user?.role === 'teacher');
	const classes = $derived(/** @type {{ id: number, name: string, color: string }[]} */ (data.classes ?? []));
	const value = $derived(data.selfAll ? 'all' : String(data.activeClass?.id ?? ''));
	const dotColor = $derived(data.selfAll ? null : (data.activeClass?.color ?? null));

	// Klasse wählen (= aktive Klasse, gilt auch für Stunde und Stundenziele) oder alle eigenen Klassen.
	/** @param {Event} e */
	async function choose(e) {
		const v = /** @type {HTMLSelectElement} */ (e.currentTarget).value;
		try {
			await api('/api/settings', 'PUT', v === 'all' ? { selfAll: true } : { classId: Number(v), selfAll: false });
			await invalidateAll();
		} catch (err) {
			showError(err);
		}
	}
</script>

<svelte:head>
	<title>Selbstlern-Modus · classRoom</title>
</svelte:head>

<GoalBoard
	students={data.students}
	user={data.user}
	kind="self"
	collapsedByDefault={data.goalsCollapsed}
	dots={data.classDots}
>
	{#snippet title()}
		Selbstlernen <span class="sub">· jeder in seinem Tempo</span>
	{/snippet}
	{#snippet actions()}
		{#if isTeacher && classes.length > 1}
			<label class="pick">
				<span class="kdot" class:all={!dotColor} style:background={dotColor}></span>
				<select {value} onchange={choose} aria-label="Klasse im Selbstlernen">
					{#each classes as c (c.id)}<option value={String(c.id)}>{c.name}</option>{/each}
					<option value="all">Alle meine Klassen</option>
				</select>
			</label>
		{/if}
	{/snippet}
</GoalBoard>

<style>
	.sub {
		color: var(--muted);
		font-size: 16px;
		font-weight: 400;
	}

	.pick {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 700;
	}

	.pick select {
		font: inherit;
		font-weight: 700;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 3px 6px;
		cursor: pointer;
	}

	.kdot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex: none;
	}

	/* Alle Klassen: Ring statt Farbe */
	.kdot.all {
		border: 2px solid var(--muted);
	}
</style>
