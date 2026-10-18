import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
	plugins: [sveltekit()],
	server: {
		port: Number(loadEnv(mode, process.cwd(), '').PORT) || 3000
	}
}));
