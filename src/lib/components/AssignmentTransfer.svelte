<script>
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/api.js';

	/**
	 * Einen Auftrag an eine andere Lehrkraft kopieren oder übertragen. Dort kommt er als Entwurf ohne Klassen an.
	 * @type {{
	 *   open: boolean,
	 *   assignment: { id: number, title: string },
	 *   teachers: { id: number, username: string }[]
	 * }}
	 */
	let { open = $bindable(false), assignment, teachers } = $props();

	const user = $derived(/** @type {import('#lib/server/auth.js').User} */ (page.data.user));

	let to = $state(0);
	/** @type {'copy' | 'move'} */
	let mode = $state('copy');
	let saving = $state(false);
	let error = $state('');
	let done = $state('');

	const target = $derived(teachers.find((t) => t.id === to));
	const targets = $derived(teachers.filter((t) => t.id !== user.id));
	const titleOf = $derived(assignment.title ? `„${assignment.title}“` : 'ohne Titel');

	// Beim Öffnen: noch kein Ziel gewählt. Nur beim Öffnen – nicht, wenn die Seite neu lädt.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			to = 0;
			mode = 'copy';
			error = '';
			done = '';
		});
	});

	async function submit() {
		if (!target) return;
		saving = true;
		error = '';
		try {
			await api('/api/assignment/transfer', 'POST', { id: assignment.id, to, mode });
			done = `Auftrag ${titleOf} ${mode === 'copy' ? 'an' : 'zu'} ${target.username} ${mode === 'copy' ? 'kopiert' : 'übertragen'}.`;
			to = 0;
			// Übertragen: Der Auftrag ist hier weg – zur Übersicht.
			if (mode === 'move') {
				open = false;
				await goto('/auftraege', { invalidateAll: true });
			} else {
				await invalidateAll();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#if open}
	<div class="dialog" role="presentation">
		<button class="backdrop" tabindex="-1" aria-label="Schließen" onclick={() => (open = false)}></button>
		<div class="panel" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
			<h2 id="transfer-title">Auftrag weitergeben</h2>

			<div class="field">
				<span class="label">Auftrag</span>
				<span class="value">{titleOf}</span>
			</div>

			<div class="field">
				<span class="label">An</span>
				<div class="list" role="radiogroup" aria-label="An Lehrkraft">
					{#each targets as t (t.id)}
						<label class="row">
							<input type="radio" name="to" value={t.id} bind:group={to} />
							<span class="name">{t.username}</span>
						</label>
					{/each}
				</div>
			</div>

			<div class="modes" role="radiogroup" aria-label="Art">
				<button type="button" role="radio" aria-checked={mode === 'copy'} class:on={mode === 'copy'} onclick={() => (mode = 'copy')}>
					<strong>Kopieren</strong>
					<small>bleibt auch bei dir</small>
				</button>
				<button type="button" role="radio" aria-checked={mode === 'move'} class:on={mode === 'move'} onclick={() => (mode = 'move')}>
					<strong>Übertragen</strong>
					<small>wird bei dir entfernt</small>
				</button>
			</div>

			<p class="note">Er kommt dort als Entwurf ohne Klassen an, ein geteilter Link geht nicht mit.</p>
			{#if error}<p class="error">{error}</p>{/if}
			{#if done}<p class="done" role="status">{done}</p>{/if}

			<div class="actions">
				<button type="button" onclick={() => (open = false)}>{done ? 'Schließen' : 'Abbrechen'}</button>
				<button type="button" class="primary" disabled={!target || saving} onclick={submit}>
					{mode === 'copy' ? 'Kopieren' : 'Übertragen'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.dialog {
		position: fixed;
		inset: 0;
		z-index: 30;
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
		background: rgb(10 15 30 / 45%);
		cursor: default;
	}

	.panel {
		position: relative;
		width: min(480px, 100%);
		max-height: calc(100dvh - 32px);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px 22px 18px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		box-shadow: 0 20px 60px rgb(10 15 30 / 35%);
		animation: pop 0.14s ease-out;
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.98);
		}
	}

	h2 {
		margin: 0;
		font-size: 18px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.label {
		color: var(--muted);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.value {
		font-weight: 600;
	}

	.list {
		display: flex;
		flex-direction: column;
		max-height: 220px;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		cursor: pointer;
	}

	.row:last-child {
		border-bottom: 0;
	}

	.row:has(input:checked) {
		background: var(--accent-soft);
	}

	.row .name {
		font-family: ui-monospace, monospace;
		font-weight: 600;
	}

	.modes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.modes button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 8px 12px;
		border-radius: 10px;
		background: var(--surface);
		text-align: left;
	}

	.modes button small {
		color: var(--muted);
		font-size: 0.78rem;
	}

	.modes button.on {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}

	.note,
	.error,
	.done {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.note {
		color: var(--muted);
	}

	.error {
		color: var(--danger);
	}

	.done {
		color: var(--ok);
		font-weight: 600;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}

	.actions button {
		padding: 8px 16px;
		font-weight: 600;
		white-space: nowrap;
	}
</style>
