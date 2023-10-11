import {
	getEventHash,
	getPublicKey,
	SimplePool,
	type Event,
	type Filter,
	type SubscriptionOptions,
	getSignature
} from 'nostr-tools';

const relayPool = new SimplePool();

const relayList = [
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
		created_at: nostrNow(),
		tags,
		pubkey
	} as Event;

	blankEvent.id = getEventHash(blankEvent);
	blankEvent.sig = getSignature(blankEvent, privkey);

	return blankEvent;
}

export function nostrNowAdjusted() {
	return nostrNow() - 60 * 2; // 2 minutes before, to work around clock drift
}

function nostrNow() {
	return Math.floor(Date.now() / 1000);
}

export function broadcastToNostr(event: Event) {
	return relayPool.publish(relayList, event);
}

export function nostrSubscribe(filters: Filter[], opts?: SubscriptionOptions) {
	return relayPool.sub(relayList, filters, opts);
}
