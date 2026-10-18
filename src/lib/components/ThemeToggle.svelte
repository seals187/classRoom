<script>
	import { onMount } from 'svelte';

	/** @type {'light' | 'dark'} */
	let theme = $state('light');

	onMount(() => {
		theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
	});

	/** @param {'light' | 'dark'} value */
	function choose(value) {
		theme = value;
		document.documentElement.setAttribute('data-theme', value);
		try {
			localStorage.setItem('theme', value);
		} catch {
			// Gilt dann nur bis zum Neuladen.
		}
	}
</script>

<div class="toggle" role="group" aria-label="Darstellung">
	<button class:on={theme === 'light'} aria-pressed={theme === 'light'} onclick={() => choose('light')}>☀ Hell</button>
	<button class:on={theme === 'dark'} aria-pressed={theme === 'dark'} onclick={() => choose('dark')}>☾ Dunkel</button>
</div>

<style>
	.toggle {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg);
	}

	button {
		padding: 5px 12px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font-size: 0.9rem;
	}

	button.on {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow);
	}
</style>
