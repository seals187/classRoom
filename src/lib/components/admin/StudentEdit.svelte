<script>
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import Modal from '../Modal.svelte';

	/**
	 * Name, Kürzel und Klassen eines Schülers ändern.
	 * @type {{
	 *   open: boolean,
	 *   student: { id: number, firstName: string, lastName: string, username: string | null } | null,
	 *   classes: { id: number, name: string, color: string }[],
	 *   classIds: number[]
	 * }}
	 */
	let { open = $bindable(false), student, classes, classIds } = $props();

	let firstName = $state('');
	let lastName = $state('');
	let username = $state('');
	/** @type {number[]} */
	let chosen = $state([]);
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		if (!open || !student) return;
		untrack(() => {
			firstName = student.firstName;
			lastName = student.lastName;
			username = student.username ?? '';
			chosen = classIds.filter((id) => classes.some((c) => c.id === id));
			error = '';
		});
	});

	/** @param {SubmitEvent} e */
	async function save(e) {
		e.preventDefault();
		if (!student) return;
		busy = true;
		error = '';
		try {
			await api(`/api/students/${student.id}`, 'PATCH', {
				firstName,
				lastName,
				...(student.username && username !== student.username && { username })
			});
			for (const c of classes) {
				const was = classIds.includes(c.id);
				const now = chosen.includes(c.id);
				if (was !== now) await api(`/api/classes/${c.id}/students`, now ? 'POST' : 'DELETE', { studentIds: [student.id] });
			}
			await invalidateAll();
			open = false;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}
</script>

<Modal bind:open title="Schüler bearbeiten" width={520}>
	<form id="student-form" onsubmit={save}>
		<div class="row">
			<label>Vorname<input type="text" bind:value={firstName} maxlength="60" required /></label>
			<label>Nachname<input type="text" bind:value={lastName} maxlength="60" required /></label>
		</div>
		{#if student?.username}
			<label>Kürzel<input type="text" class="mono" bind:value={username} maxlength="40" required /></label>
		{/if}
		{#if classes.length > 0}
			<div class="label">Klassen</div>
			<div class="chips">
				{#each classes as c (c.id)}
					<label class="chip" class:on={chosen.includes(c.id)}>
						<input type="checkbox" value={c.id} bind:group={chosen} />
						<span class="dot" style:background={c.color}></span>{c.name}
					</label>
				{/each}
			</div>
		{/if}
		{#if error}<p class="error">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<button type="button" onclick={() => (open = false)}>Abbrechen</button>
		<button type="submit" form="student-form" class="primary" disabled={busy}>Speichern</button>
	{/snippet}
</Modal>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	label,
	.label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		color: var(--muted);
		font-size: 0.85rem;
	}

	input[type='text'] {
		padding: 9px 12px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
	}

	.mono {
		font-family: ui-monospace, monospace;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		flex-direction: row;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		border: 1px solid var(--border);
		border-radius: 999px;
		color: var(--text);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.chip input {
		display: none;
	}

	.chip.on {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	.error {
		margin: 0;
		color: var(--danger);
		font-size: 0.88rem;
	}
</style>
