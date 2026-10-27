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
			location.href = user.role === 'teacher' ? '/verwaltung?tab=lehrer' : '/verwaltung?tab=schueler';
		} catch (err) {
			busy = false;
			showError(err);
		}
	}
</script>

<div class="acting" role="status">
	<span class="who">
		<Icon name="eye" size={14} />
		<span class="name">Angemeldet als <strong>{user.displayName}</strong></span>
	</span>
	<button onclick={back} disabled={busy} title="Zurück zum eigenen Konto">← Zurück zu {user.actingAdmin?.username}</button>
</div>

<style>
	/* Kleines Kärtchen unten links: oben wer, darunter zurück – schmaler als das Menü. */
	.acting {
		position: fixed;
		left: 12px;
		bottom: 12px;
		z-index: 25;
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: max-content;
		max-width: min(240px, calc(100vw - 24px));
		padding: 9px 12px 10px;
		border: 1px solid color-mix(in srgb, var(--warn) 45%, var(--border));
		border-left: 4px solid var(--warn);
		border-radius: 10px;
		background: var(--surface);
		box-shadow: var(--shadow);
		color: var(--text);
		font-size: 0.82rem;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		color: var(--muted);
	}

	.who :global(svg) {
		flex-shrink: 0;
		color: var(--warn);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name strong {
		color: var(--text);
	}

	button {
		align-self: flex-start;
		max-width: 100%;
		overflow: hidden;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font-size: 0.82rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	button:hover:not(:disabled) {
		text-decoration: underline;
	}
</style>
