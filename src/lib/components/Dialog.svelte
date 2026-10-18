<script>
	import { tick } from 'svelte';
	import { dialog } from '#lib/dialog.svelte.js';

	/** @type {HTMLButtonElement | undefined} */
	let confirmBtn = $state();
	/** @type {HTMLInputElement | undefined} */
	let input = $state();
	let value = $state('');

	const current = $derived(dialog.current);

	// Beim Öffnen: Eingabefeld bzw. Hauptknopf fokussieren (Enter bestätigt, Esc bricht ab).
	$effect(() => {
		if (!current) return;
		value = current.value;
		tick().then(() => (current.kind === 'prompt' ? input?.select() : confirmBtn?.focus()));
	});

	/** @param {boolean} ok */
	function close(ok) {
		const request = dialog.current;
		if (!request) return;
		dialog.current = null;
		if (request.kind === 'prompt') request.resolve(ok ? value : null);
		else request.resolve(request.kind === 'confirm' ? ok : null);
	}

	/** @param {SubmitEvent} e */
	function submit(e) {
		e.preventDefault();
		close(true);
	}
</script>

<svelte:window onkeydown={(e) => current && e.key === 'Escape' && close(false)} />

{#if current}
	<div class="dialog" role="presentation">
		<button class="backdrop" tabindex="-1" aria-label="Abbrechen" onclick={() => close(false)}></button>
		<form
			class="panel"
			class:danger={current.danger}
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="dialog-title"
			aria-describedby={current.message ? 'dialog-message' : undefined}
			onsubmit={submit}
		>
			<h2 id="dialog-title">{current.title}</h2>
			{#if current.message}<p id="dialog-message">{current.message}</p>{/if}
			{#if current.kind === 'prompt'}
				<input bind:this={input} type="text" bind:value placeholder={current.placeholder} />
			{/if}
			<div class="actions">
				{#if current.kind !== 'alert'}
					<button type="button" onclick={() => close(false)}>{current.cancelLabel}</button>
				{/if}
				<button bind:this={confirmBtn} type="submit" class="primary" class:danger={current.danger}>
					{current.confirmLabel}
				</button>
			</div>
		</form>
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
		width: min(460px, 100%);
		display: flex;
		flex-direction: column;
		gap: 10px;
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

	p {
		margin: 0;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.5;
		white-space: pre-line;
	}

	input {
		padding: 9px 12px;
		font-size: 15px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 8px;
	}

	.actions button {
		padding: 8px 16px;
		font-weight: 600;
		white-space: nowrap;
	}

	.actions .danger {
		border-color: var(--danger);
		background: var(--danger);
		color: #fff;
	}
</style>
