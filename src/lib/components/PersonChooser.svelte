<script context="module" lang="ts">
	import { peopleMetadata } from '$lib/stores';
	import { nip19 } from 'nostr-tools';
	import { createEventDispatcher } from 'svelte';
	import { writable } from 'svelte/store';
	import Person from './Person.svelte';

	let closeOldDropdown = writable<(() => void) | null>(null);
</script>

<script lang="ts">
	export let selectedPerson: string | null = null;
	export let people: string[];

	const dispatch = createEventDispatcher();

	let isDropdownOpen = false;
	let searchTerm = '';

	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;

		if ($closeOldDropdown) $closeOldDropdown();

		$closeOldDropdown = isDropdownOpen ? () => (isDropdownOpen = false) : null;
	}

	function selectPerson(pubkey: string | null) {
		selectedPerson = pubkey;
		isDropdownOpen = false;
		searchTerm = '';
		$closeOldDropdown = null;
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
</script>

<div class="relative">
	<div class="relative inline-block">
		<button class="cursor-pointer" on:click={toggleDropdown}>
			{#if selectedPerson}
				<Person pubkey={selectedPerson} />
			{:else}
				<img
					src="/profile.png"
					alt="Profile picture"
					class="w-20 h-20 bg-gray-300 rounded-full"
					aria-hidden="true"
				/>

				<p>Unselected</p>
			{/if}
		</button>

		{#if isDropdownOpen}
			<div
				class="mt-2 absolute z-10 bg-slate-800 border-2 border-gray-300 rounded-lg shadow-lg py-2 w-64 overflow-y-auto max-h-60"
			>
				<input
					type="text"
					class="w-full p-2 border-b border-gray-300 focus:outline-none focus:border-yellow-400 bg-slate-800"
					placeholder="Search..."
					bind:value={searchTerm}
				/>

				{#if selectedPerson}
					<button
						class="flex items-center p-2 hover:bg-slate-700 cursor-pointer w-full"
						on:click={() => selectPerson(null)}
					>
						Remove current
					</button>
				{/if}

				<button
					class="flex items-center p-2 hover:bg-slate-700 cursor-pointer w-full"
					on:click={selectFromPubkey}
				>
					Select from pubkey
				</button>

				{#if filteredPeople.length === 0}
					<p class="p-2 text-gray-500">No results found.</p>
				{:else}
					{#each filteredPeople as pubkey (pubkey)}
						<button
							class="flex items-center p-2 hover:bg-slate-700 cursor-pointer w-full"
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
			</div>
		{/if}
	</div>
</div>
