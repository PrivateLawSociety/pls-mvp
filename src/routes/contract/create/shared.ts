import { getOldestEvent, nostrNowBasic, relayList, relayPool } from '$lib/nostr';
import { peopleMetadata } from '$lib/stores';

export interface NewContractData {
	fileName?: string;
	fileHash?: string;
	clients?: [string | null, string | null];
	arbitrators?: string[];
	arbitratorsQuorum?: number;
	network?: string;
}

export async function getContactsInfo(pubkey: string) {
	const events = await relayPool.querySync(relayList, {
		authors: [pubkey],
		kinds: [3],
		until: nostrNowBasic()
	});

	if (!events) return;

	const event = getOldestEvent(events);

	const contacts = event.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1]);

	contacts.forEach(peopleMetadata.fetchPerson);

	return contacts;
}
