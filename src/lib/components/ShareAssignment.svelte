<script>
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/api.js';
	import { ask } from '#lib/dialog.svelte.js';
	import { dayChoices, daysLabel, formatExpiry, qrPath, reach, shareUrl, shortUrl } from '#lib/share.js';

	/**
	 * Auftrag öffentlich teilen: ohne Link erst starten (Gültigkeit wählen), danach groß der QR-Code
	 * mit dem Link zum Abtippen – gut scannbar am Beamer.
	 * @type {{ open: boolean, share: import('#lib/server/share.js').Share | null, corner: boolean }}
	 */
	let { open = $bindable(false), share, corner = $bindable(false) } = $props();

	const sharing = $derived(/** @type {{ publicUrl: string, days: number }} */ (page.data.sharing));
	const choices = $derived(dayChoices(sharing.days));
	let days = $state(0);
	let busy = $state(false);
	let error = $state('');

	const url = $derived(share ? shareUrl(sharing.publicUrl, share.code) : '');
	const qr = $derived(url ? qrPath(url) : null);
	// Ohne Link zählt die Adresse, über die der Link entstehen würde.
	const where = $derived(reach(sharing.publicUrl || page.url.origin));

	$effect(() => {
		if (open) {
			days = sharing.days;
			error = '';
		}
	});

	/** @param {string} method @param {Record<string, unknown>} [body] */
	async function run(method, body) {
		busy = true;
		error = '';
		try {
			await api('/api/share', method, body);
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}

	async function renew() {
		const ok = await ask({
			title: 'Neuen Link erzeugen?',
			message: 'Der bisherige Link und QR-Code funktionieren danach nicht mehr.',
			confirmLabel: 'Neuer Link'
		});
		if (ok) run('PUT', { renew: true });
	}

	async function end() {
		const ok = await ask({
			title: 'Teilen beenden?',
			message: 'Der Link funktioniert danach nicht mehr – offene Seiten zeigen „nicht mehr gültig“.',
			confirmLabel: 'Beenden',
			danger: true
		});
		if (!ok) return;
		await run('DELETE');
		corner = false;
		open = false;
	}
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#snippet hint()}
	{#if where === 'device'}
		<p class="warn">
			Die Adresse zeigt auf dieses Gerät – Handys erreichen sie so nicht. classRoom über die Netzwerk-Adresse öffnen
			oder <code>PUBLIC_URL</code> in der .env setzen.
		</p>
	{:else if where === 'local'}
		<p class="note">Nur im Schulnetz erreichbar – die Handys müssen im selben WLAN sein.</p>
	{/if}
{/snippet}

{#if open}
	<div class="dialog" role="presentation">
		<button class="backdrop" tabindex="-1" aria-label="Schließen" onclick={() => (open = false)}></button>

		{#if !share}
			<div class="panel" role="dialog" aria-modal="true" aria-labelledby="share-title">
				<h2 id="share-title">Auftrag teilen</h2>
				<p>
					Per QR-Code oder Link öffnen alle den Auftrag ohne Anmeldung – nur zum Lesen. Sichtbar sind Titel, Text,
					Bilder und Links, keine Namen, Ziele oder Fortschritte.
				</p>
				<div class="field">
					<span class="label">Gültig für</span>
					<div class="chips" role="radiogroup" aria-label="Gültig für">
						{#each choices as d (d)}
							<button type="button" role="radio" aria-checked={days === d} class:on={days === d} onclick={() => (days = d)}>
								{daysLabel(d)}
							</button>
						{/each}
					</div>
				</div>
				<p class="note">Der Auftragstext ist dann öffentlich – keine Namen von Schüler:innen hineinschreiben.</p>
				{@render hint()}
				{#if error}<p class="error">{error}</p>{/if}
				<div class="actions">
					<button type="button" onclick={() => (open = false)}>Abbrechen</button>
					<button type="button" class="primary" disabled={busy} onclick={() => run('PUT', { days })}>Teilen starten</button>
				</div>
			</div>
		{:else if qr}
			<div class="panel big" role="dialog" aria-modal="true" aria-label="QR-Code zum Auftrag">
				<svg class="qr" viewBox="0 0 {qr.size} {qr.size}" shape-rendering="crispEdges" role="img" aria-label="QR-Code: {url}">
					<rect width={qr.size} height={qr.size} fill="#fff" />
					<path d={qr.d} fill="#000" />
				</svg>
				<p class="link">{shortUrl(url)}</p>
				<div class="valid">
					<span>Gültig bis <strong>{formatExpiry(share.expiresAt)}</strong> · ab jetzt:</span>
					<div class="chips small" role="group" aria-label="Gültigkeit ändern">
						{#each choices as d (d)}
							<button type="button" disabled={busy} onclick={() => run('PUT', { days: d })}>{daysLabel(d)}</button>
						{/each}
					</div>
				</div>
				{@render hint()}
				{#if error}<p class="error">{error}</p>{/if}
				<div class="actions">
					<label class="inline">
						<input type="checkbox" bind:checked={corner} />
						Klein in der Ecke zeigen
					</label>
					<button type="button" disabled={busy} onclick={renew}>Neuer Link</button>
					<button type="button" class="danger" disabled={busy} onclick={end}>Teilen beenden</button>
					<button type="button" class="primary" onclick={() => (open = false)}>Schließen</button>
				</div>
			</div>
		{/if}
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
		background: rgb(10 15 30 / 55%);
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

	.panel.big {
		width: auto;
		max-width: 100%;
		align-items: center;
		gap: 10px;
		padding: 22px 26px 18px;
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

	p {
		margin: 0;
		line-height: 1.45;
	}

	/* Schwarz auf Weiß auch im Dunkelmodus – so lesen es alle Kameras. Höhe passt in 1280×720. */
	.qr {
		display: block;
		width: min(54vh, 78vw, 460px);
		height: auto;
		border-radius: 8px;
	}

	.link {
		font-family: ui-monospace, monospace;
		font-size: clamp(18px, 3.4vh, 30px);
		font-weight: 700;
		letter-spacing: 0.02em;
		text-align: center;
		word-break: break-all;
	}

	.valid {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 6px 10px;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.valid strong {
		color: var(--text);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		color: var(--muted);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chips button {
		padding: 7px 14px;
		border-radius: 999px;
		font-weight: 600;
	}

	.chips.small button {
		padding: 3px 10px;
		font-size: 0.85rem;
	}

	.chips button.on {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}

	.note,
	.warn,
	.error {
		font-size: 0.88rem;
	}

	.note {
		color: var(--muted);
	}

	.big .note,
	.big .warn,
	.big .error {
		max-width: 460px;
		text-align: center;
	}

	.warn {
		padding: 8px 12px;
		border-radius: 8px;
		background: var(--warn-soft, rgb(240 138 60 / 14%));
	}

	.error {
		color: var(--danger);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}

	.big .actions {
		justify-content: center;
	}

	.actions button {
		padding: 8px 16px;
		font-weight: 600;
		white-space: nowrap;
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-right: 8px;
		font-size: 0.92rem;
		cursor: pointer;
	}
</style>
