<script>
	import Modal from '../Modal.svelte';
	import CopyButton from '../CopyButton.svelte';

	/**
	 * Zugangsdaten nach dem Anlegen bzw. neuen Passwörtern – nur jetzt sichtbar, daher gleich drucken.
	 * @type {{ open: boolean, title: string, list: { name: string, username: string, password: string }[] }}
	 */
	let { open = $bindable(false), title, list } = $props();

	/** Druckblatt direkt in den body hängen – so druckt es oben links, egal wo die Seite steht. @param {HTMLElement} node */
	function toBody(node) {
		document.body.append(node);
		return { destroy: () => node.remove() };
	}

	const asText = $derived(list.map((c) => `${c.name}\tBenutzername: ${c.username}\tPasswort: ${c.password}`).join('\n'));
</script>

<Modal bind:open {title} width={620}>
	<p class="hint">Die Passwörter werden nur jetzt angezeigt – am besten gleich drucken oder kopieren.</p>
	<table>
		<thead><tr><th>Name</th><th>Benutzername</th><th>Passwort</th></tr></thead>
		<tbody>
			{#each list as c (c.username)}
				<tr><td>{c.name}</td><td><code>{c.username}</code></td><td><code>{c.password}</code></td></tr>
			{/each}
		</tbody>
	</table>
	{#snippet footer()}
		<span class="note"><CopyButton text={asText} label="Alle kopieren" showLabel /></span>
		<button onclick={() => (open = false)}>Schließen</button>
		<button class="primary" onclick={() => window.print()}>📄 Drucken</button>
	{/snippet}
</Modal>

{#if open}
	<!-- Druckblatt: ein Kärtchen pro Schüler zum Ausschneiden -->
	<div class="print-sheet" aria-hidden="true" use:toBody>
		{#each list as c (c.username)}
			<div class="card">
				<strong>{c.name}</strong>
				<span>Benutzername: <code>{c.username}</code></span>
				<span>Passwort: <code>{c.password}</code></span>
				<small>Anmelden unter {location.host}</small>
			</div>
		{/each}
	</div>
{/if}

<style>
	.hint {
		margin: 0 0 12px;
		color: var(--muted);
		font-size: 0.9rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}

	th {
		padding: 6px 8px;
		color: var(--muted);
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-align: left;
		text-transform: uppercase;
	}

	td {
		padding: 7px 8px;
		border-top: 1px solid var(--border);
	}

	code {
		padding: 1px 6px;
		border-radius: 5px;
		background: var(--bg);
		font-size: 0.95em;
	}

	.print-sheet {
		display: none;
	}

	@media print {
		:global(body > *:not(.print-sheet)) {
			display: none !important;
		}

		.print-sheet {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0;
			color: #000;
			background: #fff;
		}

		.card {
			display: flex;
			flex-direction: column;
			gap: 4px;
			padding: 14px 16px;
			border: 1px dashed #999;
			break-inside: avoid;
			font-size: 11pt;
		}

		.card strong {
			font-size: 13pt;
		}

		.card code {
			background: none;
			font-size: 12pt;
			font-weight: 700;
		}

		.card small {
			color: #555;
		}
	}
</style>
