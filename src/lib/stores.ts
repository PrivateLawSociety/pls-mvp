import { get, writable } from 'svelte/store';
import { getOldestEvent, nostrNowBasic, relayList, relayPool } from './nostr';

export interface Person {
	picture?: string;
	name?: string;
}

async function getPerson(pubkey: string) {
	const events = await relayPool.querySync(relayList, {
		authors: [pubkey],
		kinds: [0],
		until: nostrNowBasic()
	});

	if (events.length === 0) return null;

	return JSON.parse(getOldestEvent(events).content) as Person;
}

export let peopleMetadata = (() => {
	const store = writable({} as Record<string, Person | undefined>);

	const { subscribe, update } = store;

	return {
		subscribe,
		async fetchPerson(pubkey: string) {
			const current = get(store)[pubkey];

			if (current) return current;
			else {
				const person = await getPerson(pubkey);

				if (person) {
					update((value) => {
						value[pubkey] = person;

						return value;
					});
				}
			}
		}
	};
})();

export let contractDataFileStore = writable<File | null>(null);
