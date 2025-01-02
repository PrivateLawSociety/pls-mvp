import {
	getPublicKey,
	SimplePool,
	type Event,
	generateSecretKey,
	nip04,
	finalizeEvent
} from 'nostr-tools';
import { get, writable } from 'svelte/store';
import { ECPair, getNetworkByName, type NetworkNames } from './bitcoin';
import { Buffer } from 'buffer';

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
	return finalizeEvent(
		{
			content,
			created_at: nostrNowBasic(),
			kind,
			tags
		},
		Uint8Array.from(Buffer.from(privkey, 'hex'))
	);
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
	let initialPrivateKey = sessionStorage.getItem('private-key');

	const store = writable<{ privkey?: string; pubkey: string } | null>(
		initialPrivateKey
			? {
					privkey: initialPrivateKey,
					pubkey: getPublicKey(Uint8Array.from(Buffer.from(initialPrivateKey, 'hex')))
			  }
			: null
	);

	store.subscribe((keys) => {
		if (keys?.privkey) sessionStorage.setItem('private-key', keys.privkey);
	});

	function loginWithRandomKeys() {
		const privkey = generateSecretKey();
		const privkeyStr = Buffer.from(privkey).toString('hex');
		const pubkey = getPublicKey(privkey);

		navigator.clipboard.writeText(
			`private key: ${privkey}
public key: ${pubkey}`
		);

		alert(
			'Using a nostr extension such as getalby.com is recommended, but a keypair was copied to your clipboard so you can try out PLS without it'
		);

		store.set({
			privkey: privkeyStr,
			pubkey
		});

		return true;
	}

	return {
		signOut() {
			store.set(null);
			sessionStorage.removeItem('private-key');
		},
		loginWithRandomKeys,
		loginWithPrivkey(privkey: string) {
			const pubkey = getPublicKey(Uint8Array.from(Buffer.from(privkey, 'hex')));

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

			if (privkey) {
				return makeNostrEvent(privkey, kind, content, tags);
			} else {
				const blankEvent = {
					kind,
					content,
					created_at: nostrNowBasic(),
					tags,
					pubkey
				} as Event;

				// blankEvent.id = getEventHash(blankEvent);

				return window.nostr!.signEvent(blankEvent);
			}
		},
		getSigner(networkName: NetworkNames) {
			const { pubkey, privkey } = get(store)!;

			if (privkey) {
				const ecpair = ECPair.fromPrivateKey(Buffer.from(privkey, 'hex'), {
					network: getNetworkByName(networkName).network
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
