<script context="module" lang="ts">
	import { peopleMetadata } from '$lib/stores';
	import { nip19 } from 'nostr-tools';
	import { createEventDispatcher } from 'svelte';
	import Person from './Person.svelte';
	import { Dropdown, Search } from 'flowbite-svelte';
	import { UserAddSolid, UserRemoveSolid, UserSolid } from 'flowbite-svelte-icons';
</script>

<script lang="ts">
	export let selectedPerson: string | null = null;
	export let people: string[];

	export let placeholderName = 'Unselected';

	const dispatch = createEventDispatcher();

	let isDropdownOpen = false;
	let searchTerm = '';

	function selectPerson(pubkey: string | null) {
		selectedPerson = pubkey;
		isDropdownOpen = false;
		searchTerm = '';
		dispatch('selection', pubkey);
	}

	async function selectFromPubkey() {
		const result = prompt("What is the person's pubkey or npub?");

		if (result) {
			let pubkey = result.startsWith('npub') ? nip19.decode(result).data.toString() : result;

			selectPerson(pubkey);
		}
	}

	$: filteredPeople = people.filter((pubkey) =>
		$peopleMetadata[pubkey]?.name?.toLowerCase().includes(searchTerm.toLowerCase())
	);

	let iconSize = '' as 'xl';
</script>

<button class="w-20">
	{#if selectedPerson}
		<Person pubkey={selectedPerson} />
	{:else}
		<UserSolid size={iconSize} />
		<p>{placeholderName}</p>
	{/if}
</button>

<Dropdown bind:open={isDropdownOpen} class="overflow-y-auto text-sm h-44 w-64">
	<div slot="header" class="px-1">
		<Search size="md" bind:value={searchTerm} />
	</div>

	{#if filteredPeople.length === 0}
		<p class="p-2 text-gray-500">No results found.</p>
	{:else}
		{#each filteredPeople as pubkey (pubkey)}
			<button
				class="flex items-center rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600 w-full"
				on:click={() => selectPerson(pubkey)}
				title={nip19.npubEncode(pubkey)}
			>
				<img
					src={$peopleMetadata[pubkey]?.picture}
					alt={$peopleMetadata[pubkey]?.name}
					class="w-12 h-12 rounded-full mr-2 object-contain"
				/>
				<p class="break-all line-clamp-2">{$peopleMetadata[pubkey]?.name}</p>
			</button>
		{/each}
	{/if}

	<div slot="footer" class="flex justify-center" class:justify-between={selectedPerson !== null}>
		<button
			class="flex items-center p-3 text-sm font-medium text-green-600 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-green-500 hover:underline"
			on:click={selectFromPubkey}
		>
			<UserAddSolid class="w-4 h-4 me-2 text-green-700" />Add by ID
		</button>

		{#if selectedPerson}
			<button
				class="flex items-center p-3 text-sm font-medium text-red-600 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-red-500 hover:underline"
				on:click={() => selectPerson(null)}
			>
				<UserRemoveSolid class="w-4 h-4 me-2 text-red-700" />Remove
			</button>
		{/if}
	</div>
</Dropdown>
