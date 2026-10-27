<script>
	/**
	 * Fenster in der Mitte mit Titel, ✕ und Fußzeile – für die Verwaltung.
	 * @type {{
	 *   open: boolean, title: string, width?: number,
	 *   children: import('svelte').Snippet, footer?: import('svelte').Snippet
	 * }}
	 */
	let { open = $bindable(false), title, width = 520, children, footer } = $props();
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#if open}
	<div class="modal" role="presentation">
		<button class="backdrop" tabindex="-1" aria-label="Schließen" onclick={() => (open = false)}></button>
		<div class="panel" role="dialog" aria-modal="true" aria-label={title} style:width="min({width}px, 100%)">
			<div class="head">
				<h2>{title}</h2>
				<button class="close" aria-label="Schließen" onclick={() => (open = false)}>✕</button>
			</div>
			<div class="body">{@render children()}</div>
			{#if footer}<div class="foot">{@render footer()}</div>{/if}
		</div>
	</div>
{/if}

<style>
	.modal {
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
		background: rgb(5 8 15 / 55%);
		cursor: default;
	}

	.panel {
		position: relative;
		max-height: calc(100dvh - 32px);
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
		box-shadow: 0 20px 60px rgb(5 8 15 / 40%);
		animation: pop 0.14s ease-out;
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.98);
		}
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 22px 24px 14px;
	}

	h2 {
		margin: 0;
		font-size: 1.3rem;
	}

	.close {
		padding: 4px 8px;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 1rem;
	}

	.body {
		overflow-y: auto;
		padding: 0 24px 18px;
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		margin: 0 24px;
		padding: 16px 0 22px;
		border-top: 1px solid var(--border);
	}

	.foot :global(.note) {
		margin-right: auto;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.foot :global(button) {
		padding: 9px 16px;
		font-weight: 600;
		white-space: nowrap;
	}
</style>
