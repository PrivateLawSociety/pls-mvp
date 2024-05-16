import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
	plugins: [wasm(), topLevelAwait(), nodePolyfills(), sveltekit()],
	optimizeDeps: {
		include: [
			'liquidjs-lib',
			'@vulpemventures/secp256k1-zkp',
			'bitcoinjs-lib',
			'crypto',
			'ecpair',
			'tiny-secp256k1',
			'nostr-tools',
			'qrcode-generator',
			'bitcoinjs-lib/src/psbt/bip371',
			'liquidjs-lib/src/psetv2',
			'liquidjs-lib/src/psetv2/utils',
			'liquidjs-lib/src/confidential',
			'liquidjs-lib/src/transaction',
			'liquidjs-lib/src/value',
			'liquidjs-lib/src/issuance',
			'liquidjs-lib/src/asset'
		],
		esbuildOptions: {
			// Node.js global to browser globalThis
			define: {
				global: 'globalThis'
			},
			// Enable esbuild polyfill plugins
			plugins: [
				NodeGlobalsPolyfillPlugin({
					buffer: true
				})
			]
		}
	},
	build: {
		rollupOptions: {
			external: ['@vulpemventures/secp256k1-zkp']
		}
	}
});
