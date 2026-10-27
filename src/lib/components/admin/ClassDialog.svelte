<script>
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import Modal from '../Modal.svelte';

	// Wie CLASS_COLORS in classes.js
	const COLORS = ['#3b6fe0', '#f08a3c', '#8b5cd6', '#2f9e64', '#e0484a', '#1f9bb0', '#d6489a', '#c99a06'];

	/**
	 * Neue Klasse bzw. Name und Farbe ändern.
	 * @type {{ open: boolean, klass?: { id: number, name: string, color: string } | null, count?: number, onsaved?: (id: number) => void }}
	 */
	let { open = $bindable(false), klass = null, count = 0, onsaved } = $props();

	let name = $state('');
	let color = $state(COLORS[0]);
	let error = $state('');
	let busy = $state(false);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			name = klass?.name ?? '';
			color = klass?.color ?? COLORS[count % COLORS.length];
			error = '';
		});
	});

	/** @param {SubmitEvent} e */
	async function save(e) {
		e.preventDefault();
		busy = true;
		error = '';
		try {
			let id = klass?.id ?? 0;
			if (klass) await api(`/api/classes/${klass.id}`, 'PATCH', { name, color });
			else id = (await api('/api/classes', 'POST', { name, color })).id;
			await invalidateAll();
			open = false;
			onsaved?.(id);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}
</script>

<Modal bind:open title={klass ? 'Klasse bearbeiten' : 'Neue Klasse'} width={420}>
	<form id="class-form" onsubmit={save}>
		<label>
			<span class="label">Name</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input type="text" bind:value={name} maxlength="40" placeholder="z. B. 5a oder Förderkurs" required autofocus />
		</label>
		<div class="label">Farbe</div>
		<div class="colors" role="radiogroup" aria-label="Farbe">
			{#each COLORS as c (c)}
				<button
					type="button"
					role="radio"
					aria-checked={color === c}
					aria-label="Farbe {c}"
					class:on={color === c}
					style:--c={c}
					onclick={() => (color = c)}
				></button>
			{/each}
		</div>
		{#if error}<p class="error">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<button type="button" onclick={() => (open = false)}>Abbrechen</button>
		<button type="submit" form="class-form" class="primary" disabled={busy || !name.trim()}>{klass ? 'Speichern' : 'Klasse anlegen'}</button>
	{/snippet}
</Modal>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		color: var(--muted);
		font-size: 0.85rem;
	}

	input {
		padding: 9px 12px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
	}

	.colors {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 4px;
	}

	.colors button {
		width: 30px;
		height: 30px;
		padding: 0;
		border: 3px solid transparent;
		border-radius: 50%;
		background: var(--c);
		box-shadow: inset 0 0 0 2px var(--surface);
	}

	.colors button.on {
		border-color: var(--c);
	}

	.error {
		margin: 0;
		color: var(--danger);
		font-size: 0.88rem;
	}
</style>
