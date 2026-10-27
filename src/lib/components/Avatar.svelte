<script>
	import { avatarColor, initials } from '#lib/avatar.js';

	/** @type {{ id: number, name: string, size?: number }} */
	let { id, name, size = 30 } = $props();
</script>

<span class="avatar" style:--size="{size}px" style:background={avatarColor(id)} title={name} aria-hidden="true">
	{initials(name)}
</span>

<style>
	.avatar {
		flex-shrink: 0;
		display: inline-grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		color: #fff;
		font-size: calc(var(--size) * 0.36);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1;
	}
</style>
