<script lang="ts">
	import PersonChooser from '$lib/components/PersonChooser.svelte';
	import { Button, P } from 'flowbite-svelte';

	import { nostrAuth } from '$lib/nostr';
	import { getContext, onMount } from 'svelte';
	import { peopleMetadata } from '$lib/stores';
	import type { Writable } from 'svelte/store';
	import { getContactsInfo, type NewContractData } from '../shared';

	let myPubkey: string | null = null;

	let contactPubkeys: string[] = [];

	let newContract = getContext<Writable<NewContractData>>('contract');

	let clients: [string | null, string | null] = $newContract.clients ?? [null, null];

	$: $newContract.clients = clients;

	$: contactsAndMe = Array.from(
		myPubkey ? new Set([myPubkey, ...contactPubkeys]) : new Set(contactPubkeys)
	);

	onMount(async () => {
		if (await nostrAuth.tryLogin()) {
			const pubkey = $nostrAuth?.pubkey!;

			myPubkey = pubkey;

			peopleMetadata.fetchPerson(pubkey);
			contactPubkeys = (await getContactsInfo(pubkey)) ?? [];
		}
	});
</script>

<P class="text-2xl">Select contract clients</P>

<div class="flex gap-4 items-center h-full">
	<PersonChooser people={contactsAndMe} bind:selectedPerson={clients[0]} />
	<PersonChooser people={contactsAndMe} bind:selectedPerson={clients[1]} />
</div>
<a href="/contract/create/3">
	<Button class="w-48 md:w-52" disabled={!(clients[0] && clients[1])}>Next</Button>
</a>
