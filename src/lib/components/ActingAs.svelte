<script>
	import { api } from '#lib/api.js';
	import { showError } from '#lib/dialog.svelte.js';
	import Icon from './Icon.svelte';

	/**
	 * „Anmelden als …“: Hinweis unten links, solange der Admin als andere Person angemeldet ist.
	 * Schwebt über der Seite – nichts verschiebt sich, 1280×720 bleibt ohne Scrollen.
	 * @type {{ user: import('#lib/server/auth.js').User }}
	 */
	let { user } = $props();

	let busy = $state(false);

	async function back() {
		busy = true;
		try {
			await api('/api/impersonate', 'DELETE');
			// Ganz neu laden: andere Person, andere Klasse, andere Rechte.
			location.href = user.role === 'teacher' ? '/lehrer' : '/schueler';
		} catch (err) {
			busy = false;
			showError(err);
		}
	}
</script>

<div class="acting" role="status">
	<Icon name="eye" size={15} />
	<span>Angemeldet als <strong>{user.displayName}</strong></span>
	<button onclick={back} disabled={busy}>Zurück zu {user.actingAdmin?.username}</button>
</div>

<style>
	.acting {
		position: fixed;
		left: 12px;
		bottom: 12px;
		z-index: 25;
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: calc(100vw - 24px);
		padding: 5px 6px 5px 12px;
		border: 1px solid color-mix(in srgb, var(--warn) 60%, transparent);
		border-radius: 999px;
		background: var(--warn-soft);
		box-shadow: var(--shadow);
		color: var(--text);
		font-size: 0.85rem;
	}

	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	button {
		flex-shrink: 0;
		padding: 4px 12px;
		border-radius: 999px;
		font-size: 0.82rem;
		font-weight: 700;
	}
</style>
