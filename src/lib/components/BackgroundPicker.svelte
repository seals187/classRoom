<script>
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { ask } from '#lib/dialog.svelte.js';
	import { GRADIENTS, PHOTOS, photoUrl } from '#lib/backgrounds.js';
	import { PATTERNS } from '#lib/patterns.js';
	import { shrinkImage } from '#lib/shrink-image.js';
	import Icon from './Icon.svelte';

	/**
	 * Hintergrund für Auftrag, Stundenziele und Selbstlernen wählen: Farbverläufe oder eigene Bilder.
	 * @type {{ open: boolean, isTeacher: boolean }}
	 */
	let { open = $bindable(false), isTeacher } = $props();

	/** @type {'gradients' | 'patterns' | 'photos' | 'images'} */
	let tab = $state('gradients');
	/** @type {(import('#lib/server/backgrounds.js').BackgroundState & { images: import('#lib/server/backgrounds.js').BackgroundImage[] }) | null} */
	let bg = $state(null);
	let busy = $state(false);
	let error = $state('');
	/** @type {HTMLInputElement | undefined} */
	let fileInput = $state();

	// Lehrkraft wählt den Klassen-Hintergrund, Schüler ihren eigenen ('' = wie die Klasse).
	const selected = $derived(bg ? (isTeacher ? bg.classValue : bg.ownValue) : '');

	$effect(() => {
		if (open) load();
	});

	async function load() {
		error = '';
		try {
			bg = await api('/api/background', 'GET');
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	/** @param {() => Promise<unknown>} action */
	async function run(action) {
		busy = true;
		error = '';
		try {
			await action();
			await load();
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}

	/** @param {string} value */
	const choose = (value) => run(() => api('/api/background', 'PUT', { value }));

	/** @param {'fixed' | 'free'} mode */
	const setMode = (mode) => run(() => api('/api/background', 'PUT', { mode }));

	/** @param {Event} e */
	function onFiles(e) {
		const input = /** @type {HTMLInputElement} */ (e.currentTarget);
		const files = [...(input.files ?? [])].filter((f) => f.type.startsWith('image/'));
		input.value = '';
		if (files.length === 0) return;
		run(async () => {
			for (const file of files) {
				// Erst im Browser verkleinern (einige hundert KB), dann hochladen – und gleich auswählen.
				const form = new FormData();
				form.append('file', await shrinkImage(file));
				const image = await api('/api/background/images', 'POST', form);
				await api('/api/background', 'PUT', { value: `i:${image.id}` });
			}
		});
	}

	/** @param {number} id */
	async function remove(id) {
		if (!(await ask({ title: 'Bild löschen?', message: 'Wer es als Hintergrund benutzt, hat danach keinen mehr.', confirmLabel: 'Löschen', danger: true }))) return;
		run(() => api(`/api/background/images/${id}`, 'DELETE'));
	}
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#if open}
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="bg-title">
		<button class="backdrop" tabindex="-1" aria-label="Schließen" onclick={() => (open = false)}></button>
		<div class="panel">
			<div class="head">
				<h2 id="bg-title">Hintergrund</h2>
				<button class="icon-btn" aria-label="Schließen" onclick={() => (open = false)}><Icon name="close" size={18} /></button>
			</div>
			<p class="hint">Für Auftrag, Stundenziele und Selbstlernen.</p>

			{#if isTeacher && bg}
				<div class="mode" role="radiogroup" aria-label="Wer wählt den Hintergrund?">
					<label>
						<input type="radio" name="bg-mode" checked={bg.mode === 'fixed'} disabled={busy} onchange={() => setMode('fixed')} />
						Für alle festlegen
					</label>
					<label>
						<input type="radio" name="bg-mode" checked={bg.mode === 'free'} disabled={busy} onchange={() => setMode('free')} />
						Schüler wählen selbst <span class="muted">(deine Wahl ist ihr Standard)</span>
					</label>
				</div>
			{/if}

			<div class="tabs" role="tablist">
				<button role="tab" aria-selected={tab === 'gradients'} class:active={tab === 'gradients'} onclick={() => (tab = 'gradients')}>
					Farbverläufe
				</button>
				<button role="tab" aria-selected={tab === 'patterns'} class:active={tab === 'patterns'} onclick={() => (tab = 'patterns')}>
					Muster
				</button>
				<button role="tab" aria-selected={tab === 'photos'} class:active={tab === 'photos'} onclick={() => (tab = 'photos')}>
					Fotos
				</button>
				<button role="tab" aria-selected={tab === 'images'} class:active={tab === 'images'} onclick={() => (tab = 'images')}>
					Eigene Bilder
				</button>
			</div>

			{#if bg}
				<div class="grid">
					<button class="tile none" class:selected={selected === ''} disabled={busy} onclick={() => choose('')}>
						{isTeacher ? 'Ohne' : 'Wie die Klasse'}
					</button>
					{#if tab === 'gradients'}
						{#each GRADIENTS as g (g.id)}
							{@const value = `g:${g.id}`}
							<button
								class="tile"
								class:selected={selected === value}
								style:background={g.css}
								aria-label="Farbverlauf {g.id}"
								disabled={busy}
								onclick={() => choose(value)}
							></button>
						{/each}
					{:else if tab === 'patterns'}
						{#each PATTERNS as p (p.id)}
							{@const value = `p:${p.id}`}
							<button
								class="tile"
								class:selected={selected === value}
								style:background={p.css}
								title={p.name}
								aria-label="Muster {p.name}"
								disabled={busy}
								onclick={() => choose(value)}
							></button>
						{/each}
					{:else if tab === 'photos'}
						{#each PHOTOS as photo (photo.id)}
							{@const value = `f:${photo.id}`}
							<button
								class="tile"
								class:selected={selected === value}
								style:background-image="url({photoUrl(photo.id, true)})"
								title="{photo.name} – Foto: {photo.credit}"
								aria-label="Foto {photo.name}"
								disabled={busy}
								onclick={() => choose(value)}
							></button>
						{/each}
					{:else}
						{#each bg.images as image (image.id)}
							{@const value = `i:${image.id}`}
							<div class="image">
								<button
									class="tile"
									class:selected={selected === value}
									style:background-image="url({image.url})"
									aria-label="Bild auswählen"
									disabled={busy}
									onclick={() => choose(value)}
								></button>
								{#if image.own}
									<button class="remove icon-btn" aria-label="Bild löschen" disabled={busy} onclick={() => remove(image.id)}>✕</button>
								{/if}
							</div>
						{/each}
						<button class="tile add" disabled={busy} onclick={() => fileInput?.click()}>
							{busy ? 'Lädt…' : '+ Bild hochladen'}
						</button>
					{/if}
				</div>
				{#if tab === 'images'}
					<p class="hint">Bilder werden vor dem Hochladen verkleinert (höchstens 1920 px, einige hundert KB).</p>
				{/if}
			{/if}
			{#if error}<p class="error">{error}</p>{/if}
		</div>
	</div>
	<input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onchange={onFiles} />
{/if}

<style>
	.dialog {
		position: fixed;
		inset: 0;
		z-index: 20;
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
		width: min(560px, 100%);
		max-height: calc(100dvh - 32px);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px 20px 20px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: 0 20px 60px rgb(10 15 30 / 30%);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		font-size: 1.15rem;
	}

	.hint {
		margin: -6px 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.grid + .hint {
		margin-top: 0;
	}

	.mode {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--bg);
		font-size: 0.92rem;
	}

	.mode label {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.muted {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.tabs button {
		padding: 7px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		font-weight: 500;
	}

	.tabs button.active {
		background: var(--bg);
		color: var(--text);
		font-weight: 700;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}

	.tile {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background-position: center;
		background-size: cover;
		cursor: pointer;
	}

	.tile:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	/* Gewählt: Rahmen und Häkchen oben links. */
	.tile.selected {
		outline: 3px solid var(--accent);
		outline-offset: 2px;
	}

	.tile.selected::after {
		content: '✓';
		position: absolute;
		top: 4px;
		left: 6px;
		color: #fff;
		font-weight: 800;
		text-shadow: 0 1px 3px rgb(0 0 0 / 60%);
	}

	.tile.none,
	.tile.add {
		border: 1px dashed var(--border);
		background: var(--bg);
		color: var(--muted);
		font-size: 0.82rem;
	}

	.tile.none.selected::after {
		color: var(--accent);
		text-shadow: none;
	}

	.image {
		position: relative;
	}

	.remove {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		font-size: 0.75rem;
	}

	.error {
		margin: 0;
		color: var(--danger);
		font-size: 0.88rem;
	}

	@media (max-width: 480px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
