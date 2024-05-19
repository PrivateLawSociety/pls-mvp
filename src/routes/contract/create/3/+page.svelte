<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { getContactsInfo, type NewContractData } from '../shared';
	import PersonChooser from '$lib/components/PersonChooser.svelte';
	import { nostrAuth } from '$lib/nostr';
	import { peopleMetadata } from '$lib/stores';
	import { Button, Input, Label, P, Range } from 'flowbite-svelte';

	const newContract = getContext<Writable<NewContractData>>('contract');

	let arbitrators: string[] = $newContract.arbitrators ?? [];

	let myPubkey: string | null = null;

	let contactPubkeys: string[] = [];

	let newlySelectedPubkey: string | null = null;

	let arbitratorsQuorum = $newContract.arbitratorsQuorum ?? 1;

	$: if (arbitratorsQuorum > arbitrators.length) {
		arbitratorsQuorum = arbitrators.length || 1;
	}

	$: contactsAndMe = Array.from(
		myPubkey ? new Set([myPubkey, ...contactPubkeys]) : new Set(contactPubkeys)
	);

	$: $newContract.arbitrators = arbitrators;
	$: $newContract.arbitratorsQuorum = arbitratorsQuorum;

	onMount(async () => {
		if (await nostrAuth.tryLogin()) {
			const pubkey = $nostrAuth?.pubkey!;

			myPubkey = pubkey;

			peopleMetadata.fetchPerson(pubkey);
			contactPubkeys = (await getContactsInfo(pubkey)) ?? [];
		}
	});

	$: console.log($newContract.arbitratorsQuorum);
</script>

<P class="text-2xl">Select arbitrators</P>
<div class="flex flex-col justify-center items-center gap-4 h-full">
	<div class="flex gap-4 flex-wrap justify-center items-center">
		{#each arbitrators as _, i}
			<PersonChooser
				people={contactsAndMe}
				on:selection={(e) => {
					if (e.detail === null) {
						arbitrators = arbitrators.filter((_, index) => index !== i);
					}
				}}
				bind:selectedPerson={arbitrators[i]}
			/>
		{/each}
		<PersonChooser
			people={contactsAndMe}
			on:selection={(e) => {
				arbitrators = [...arbitrators, e.detail];
				newlySelectedPubkey = null;
			}}
			bind:selectedPerson={newlySelectedPubkey}
			placeholderName={'Add new'}
		/>
	</div>
	{#if arbitrators.length > 1}
		<P class="text-2xl">Arbitrators quorum</P>
		<div class="mx-12">
			<Label>This is the minimum number of arbitrators needed to make a decision.</Label>
			<Range bind:value={arbitratorsQuorum} min={1} max={arbitrators.length || 1} />
		</div>
		<p>{arbitratorsQuorum}</p>
	{/if}
</div>
<a href="/contract/create/4">
	<Button class="w-48 md:w-52" disabled={arbitrators.length < 1}>Next</Button>
</a>
