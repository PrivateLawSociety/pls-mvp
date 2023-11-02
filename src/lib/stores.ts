import { get, writable } from 'svelte/store';
import { nostrNowBasic, relayList, relayPool } from './nostr';
// import { utils} from "nostr-tools"
// utils.insertEventIntoAscendingList()

export interface Person {
	picture?: string;
	name?: string;
}

async function getPerson(pubkey: string) {
	const events = await relayPool.batchedList('getPerson', relayList, [
		{
			authors: [pubkey],
			kinds: [0],
			until: nostrNowBasic()
		}
	]);

	if (events.length === 0) return null;

	const ascendingEvents = events.sort((a, b) => a.created_at - b.created_at);

	const lastEvent = ascendingEvents[ascendingEvents.length - 1];

	return JSON.parse(lastEvent.content) as Person;
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
