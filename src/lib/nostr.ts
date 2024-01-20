import {
	getEventHash,
	getPublicKey,
	SimplePool,
	type Event,
	getSignature,
	generatePrivateKey,
	nip04
} from 'nostr-tools';
import { get, writable } from 'svelte/store';
import { ECPair, NETWORK } from './bitcoin';

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

export function getOldestEvent(events: Event[]) {
	const ascendingEvents = events.sort((a, b) => a.created_at - b.created_at);

	const lastEvent = ascendingEvents[ascendingEvents.length - 1];

	return lastEvent;
}

export let nostrAuth = (() => {
	const store = writable<{ privkey?: string; pubkey: string } | null>();

	function loginWithRandomKeys() {
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
		loginWithRandomKeys,
		loginWithPrivkey(privkey: string) {
			const pubkey = getPublicKey(privkey);

			store.set({
				privkey,
				pubkey
			});
		},
		getPrivkey() {
			return get(store)?.privkey;
		},
		async tryLogin() {
			if (get(store)?.pubkey) return true;

			if (window.nostr) {
				try {
					const pubkey: string = await window.nostr.getPublicKey();

					store.set({ pubkey });

					return true;
				} catch (error) {
					return loginWithRandomKeys();
				}
			} else {
				return loginWithRandomKeys();
			}
		},
		async encryptDM(otherPubkey: string, text: string) {
			const privkey = get(store)?.privkey;

			if (privkey) {
				return await nip04.encrypt(privkey, otherPubkey, text);
			} else {
				return await window.nostr!.nip04.encrypt(otherPubkey, text);
			}
		},
		async decryptDM(otherPubkey: string, text: string) {
			const privkey = get(store)?.privkey;

			if (privkey) {
				return await nip04.decrypt(privkey, otherPubkey, text);
			} else {
				return await window.nostr!.nip04.decrypt(otherPubkey, text);
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
				return window.nostr!.signEvent(blankEvent);
			}
		},
		getSigner() {
			const { pubkey, privkey } = get(store)!;

			if (privkey) {
				const ecpair = ECPair.fromPrivateKey(Buffer.from(privkey, 'hex'), {
					network: NETWORK.network
				});

				return ecpair;
			} else if (pubkey) {
				if (!window.nostr?.signSchnorr)
					return alert("Your extension doesn't support signing") as undefined;

				return {
					publicKey: Buffer.from('02' + pubkey, 'hex'),
					sign() {
						throw new Error('Signing without schnorr is not possible with the extension');
					},
					async signSchnorr(hash: Buffer) {
						return Buffer.from(await window.nostr!.signSchnorr(hash.toString('hex')), 'hex');
					}
				};
			}
		},
		subscribe: store.subscribe
	};
})();
