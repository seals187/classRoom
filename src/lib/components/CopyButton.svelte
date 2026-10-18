<script>
	import { notify } from '#lib/dialog.svelte.js';
	import Icon from './Icon.svelte';

	/** @type {{ text: string, label: string, showLabel?: boolean }} */
	let { text, label, showLabel = false } = $props();

	let copied = $state(false);
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timer;

	/**
	 * Die Clipboard-API gibt es nur bei HTTPS bzw. localhost. Im Schulnetz (http://IP:3000)
	 * fällt sie weg – dann über ein unsichtbares Textfeld kopieren.
	 * @param {string} value
	 */
	async function writeClipboard(value) {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(value);
			return;
		}
		const area = document.createElement('textarea');
		area.value = value;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.append(area);
		area.select();
		const ok = document.execCommand('copy');
		area.remove();
		if (!ok) throw new Error('Kopieren nicht möglich');
	}

	async function copy() {
		try {
			await writeClipboard(text);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 1500);
		} catch {
			notify('Bitte von Hand markieren und kopieren.', 'Kopieren hat nicht geklappt');
		}
	}
</script>

<button
	type="button"
	class="copy"
	class:icon-btn={!showLabel}
	class:copied
	title={copied ? 'Kopiert' : label}
	aria-label={label}
	onclick={copy}
>
	<Icon name={copied ? 'check' : 'copy'} size={16} />
	{#if showLabel}<span>{copied ? 'Kopiert' : label}</span>{/if}
</button>
<span class="sr-only" aria-live="polite">{copied ? 'Kopiert' : ''}</span>

<style>
	.copy {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-left: 6px;
		vertical-align: middle;
	}

	.copy.icon-btn {
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		padding: 0;
	}

	.copy :global(svg) {
		flex-shrink: 0;
	}

	.copied {
		border-color: var(--ok);
		color: var(--ok);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
