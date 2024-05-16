import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess({})],

	kit: {
		alias: {
			// I hate this but it works so I don't care
			'pls-bitcoin': './node_modules/pls-lib/packages/pls-bitcoin/index',
			'pls-core': './node_modules/pls-lib/packages/pls-core/index',
			'pls-full': './node_modules/pls-lib/packages/pls-full/index',
			'pls-liquid': './node_modules/pls-lib/packages/pls-liquid/index',
			'pls-nostr': './node_modules/pls-lib/packages/pls-nostr'

			// If you want to use pls-lib locally
			// 'pls-bitcoin': '../pls-lib/packages/pls-bitcoin',
			// 'pls-core': '../pls-lib/packages/pls-core',
			// 'pls-full': '../pls-lib/packages/pls-full',
			// 'pls-liquid': '../pls-lib/packages/pls-liquid',
			// 'pls-nostr': '../pls-lib/packages/pls-nostr'
		},
		adapter: adapter({ runtime: 'nodejs20.x' })
	}
};

export default config;
