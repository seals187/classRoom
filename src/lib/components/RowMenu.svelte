<script>
	/**
	 * „⋯“-Knopf mit kleinem Menü (schließt bei Klick daneben oder Esc).
	 * @type {{ label: string, items: { label: string, action: () => void, danger?: boolean, disabled?: boolean, hidden?: boolean }[], plain?: boolean }}
	 */
	let { label, items, plain = false } = $props();

	let open = $state(false);
	/** @type {HTMLElement | undefined} */
	let root = $state();

	const shown = $derived(items.filter((i) => !i.hidden));
</script>

<svelte:window
	onclick={(e) => open && !root?.contains(/** @type {Node} */ (e.target)) && (open = false)}
	onkeydown={(e) => open && e.key === 'Escape' && (open = false)}
/>

<span class="wrap" bind:this={root}>
	<button class="dots" class:plain aria-label={label} title={label} aria-expanded={open} onclick={() => (open = !open)}>⋯</button>
	{#if open}
		<div class="menu" role="menu">
			{#each shown as item (item.label)}
				<button
					role="menuitem"
					class:danger={item.danger}
					disabled={item.disabled}
					onclick={() => {
						open = false;
						item.action();
					}}>{item.label}</button
				>
			{/each}
		</div>
	{/if}
</span>

<style>
	.wrap {
		position: relative;
		display: inline-flex;
	}

	.dots {
		display: inline-grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border-radius: 8px;
		color: var(--muted);
		font-size: 1.05rem;
		line-height: 1;
	}

	.dots.plain {
		width: 24px;
		height: 24px;
		border: 0;
		background: transparent;
	}

	.menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 20;
		min-width: 190px;
		display: flex;
		flex-direction: column;
		padding: 5px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		box-shadow: 0 10px 30px rgb(5 8 15 / 25%);
	}

	.menu button {
		padding: 7px 10px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--text);
		font-size: 0.9rem;
		text-align: left;
		white-space: nowrap;
	}

	.menu button:hover:not(:disabled) {
		background: var(--bg);
	}

	.menu button.danger {
		color: var(--danger);
	}
</style>
