import {
	getEventHash,
	getPublicKey,
	SimplePool,
	type Event,
	type Filter,
	type SubscriptionOptions,
	getSignature,
	generatePrivateKey,
	nip04
} from 'nostr-tools';
import { get, writable } from 'svelte/store';
import { ECPair } from './pls/multisig';

export const relayPool = new SimplePool();

export const relayList = [
	'wss://nostr-pub.wellorder.net',
	'wss://relay.nostr.band',
	'wss://relay.damus.io',
	'wss://nostr.fmt.wiz.biz',
	'wss://offchain.pub',
	'wss://relay.current.fyi',
	'wss://nos.lol'
];

export async function makeNostrEvent(
	privkey: string,
	kind: number,
	content: string,
	tags: string[][]
) {
	const pubkey = getPublicKey(privkey);

	const blankEvent = {
		kind,
		content,
		created_at: nostrNowBasic(),
		tags,
		pubkey
	} as Event;

	blankEvent.id = getEventHash(blankEvent);
	blankEvent.sig = getSignature(blankEvent, privkey);

	return blankEvent;
}

export function nostrNowAdjusted() {
	return nostrNowBasic() - 60 * 2; // 2 minutes before, to work around clock drift
}

export function nostrNowBasic() {
	return Math.floor(Date.now() / 1000);
}

export function broadcastToNostr(event: Event) {
	return relayPool.publish(relayList, event);
}

export let nostrAuth = (() => {
	const store = writable<{ privkey?: string; pubkey: string } | null>();

	function generateKeys() {
		const privkey = generatePrivateKey();
		const pubkey = getPublicKey(privkey);

		navigator.clipboard.writeText(
			`private key: ${privkey}
public key: ${pubkey}`
		);

		alert(
			'Using a nostr extension such as getalby.com is recommended, but a keypair was copied to your clipboard so you can try out PLS without it'
		);

		store.set({
			privkey,
			pubkey
		});

		return true;
	}

	return {
		loginWithPrivkey(privkey: string) {
			const pubkey = getPublicKey(privkey);

			store.set({
				privkey,
				pubkey
			});
		},
		async tryLogin() {
			if (get(store)?.pubkey) return true;

			// @ts-expect-error
			if (window.nostr) {
				try {
					// @ts-expect-error
					const pubkey: string = await window.nostr.getPublicKey();

					store.set({ pubkey });

					return true;
				} catch (error) {
					return generateKeys();
				}
			} else {
				return generateKeys();
			}
		},
		async encryptDM(otherPubkey: string, text: string) {
			const privkey = get(store)?.privkey;

			if (privkey) {
				return await nip04.encrypt(privkey, otherPubkey, text);
			} else {
				// @ts-expect-error
				return (await window.nostr.nip04.encrypt(otherPubkey, text)) as string;
			}
		},
		async decryptDM(otherPubkey: string, text: string) {
			const privkey = get(store)?.privkey;

			if (privkey) {
				return await nip04.decrypt(privkey, otherPubkey, text);
			} else {
				// @ts-expect-error
				return (await window.nostr.nip04.decrypt(otherPubkey, text)) as string;
			}
		},
		async makeEvent(kind: number, content: string, tags: string[][]) {
			const { pubkey, privkey } = get(store)!;

			const blankEvent = {
				kind,
				content,
				created_at: nostrNowBasic(),
				tags,
				pubkey
			} as Event;

			blankEvent.id = getEventHash(blankEvent);

			if (privkey) {
				blankEvent.sig = getSignature(blankEvent, privkey);

				return blankEvent;
			} else {
				// @ts-expect-error
				return window.nostr.signEvent(blankEvent);
			}
		},
		async signSchnorr(hash: Buffer) {
			const privkey = get(store)?.privkey;

			if (privkey) {
				return ECPair.fromPrivateKey(Buffer.from(privkey, 'hex')).signSchnorr(hash);
			} else {
				// @ts-expect-error
				return window.nostr.signSchnorr(hash) as Buffer;
			}
		},
		subscribe: store.subscribe
	};
})();
