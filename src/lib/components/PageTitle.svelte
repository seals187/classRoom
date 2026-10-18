<script>
	import { navIcon } from '#lib/nav.js';
	import Icon from './Icon.svelte';

	/** Seitenüberschrift mit demselben Symbol wie im Menü. */
	/** @type {{ href: string, children: import('svelte').Snippet }} */
	let { href, children } = $props();
</script>

<h1>
	<span class="icon"><Icon name={navIcon(href)} size={28} /></span>
	{@render children()}
</h1>

<style>
	h1 {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0;
		font-size: 1.6rem;
	}

	.icon {
		display: inline-grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		border-radius: 12px;
		background: var(--accent-soft);
		color: var(--accent);
	}
</style>
