import type { Event, EventTemplate } from 'nostr-tools';

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
	interface Window {
		nostr?: {
			signSchnorr(hash: Buffer): Promise<Buffer>;
			getPublicKey(): Promise<string>;
			signEvent(event: EventTemplate): Promise<Event>;
			nip04: {
				encrypt(pubkey: string, text: string): Promise<string>;
				decrypt(pubkey: string, data: string): Promise<string>;
			};
		};
	}
}

export {};
