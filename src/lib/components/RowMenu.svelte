<script>
	/**
	 * „⋯“-Knopf mit kleinem Menü (schließt bei Klick daneben oder Esc).
	 * @type {{ label: string, items: { label: string, action: () => void, danger?: boolean, disabled?: boolean, hidden?: boolean }[], plain?: boolean }}
	 */
	let { label, items, plain = false } = $props();

	let open = $state(false);
	/** @type {HTMLElement | undefined} */
	let root = $state();
	/** @type {HTMLButtonElement | undefined} */
	let button = $state();
	// Fest im Fenster statt in der Tabelle – sonst schneidet deren Rand das Menü ab (z. B. in der letzten Zeile).
	let pos = $state({ top: 0, right: 0, up: false });

	const shown = $derived(items.filter((i) => !i.hidden));
	const MENU_ITEM = 34;

	function toggle() {
		if (open || !button) {
			open = false;
			return;
		}
		const r = button.getBoundingClientRect();
		// Unten zu wenig Platz → nach oben aufklappen.
		const up = r.bottom + shown.length * MENU_ITEM + 16 > innerHeight && r.top > innerHeight - r.bottom;
		pos = { top: up ? r.top - 4 : r.bottom + 4, right: innerWidth - r.right, up };
		open = true;
	}
</script>

<svelte:window
	onclick={(e) => open && !root?.contains(/** @type {Node} */ (e.target)) && (open = false)}
	onkeydown={(e) => open && e.key === 'Escape' && (open = false)}
	onscroll={() => (open = false)}
	onresize={() => (open = false)}
/>

<span class="wrap" bind:this={root}>
	<button class="dots" class:plain aria-label={label} title={label} aria-expanded={open} bind:this={button} onclick={toggle}>⋯</button>
	{#if open}
		<div class="menu" class:up={pos.up} role="menu" style:top="{pos.top}px" style:right="{pos.right}px">
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
		position: fixed;
		z-index: 40;
		min-width: 190px;
		display: flex;
		flex-direction: column;
		padding: 5px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		box-shadow: 0 10px 30px rgb(5 8 15 / 25%);
	}

	.menu.up {
		transform: translateY(-100%);
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
