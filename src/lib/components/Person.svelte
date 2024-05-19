<script lang="ts">
	import { peopleMetadata } from '$lib/stores';
	import { UserSolid } from 'flowbite-svelte-icons';
	import { nip19 } from 'nostr-tools';

	export let pubkey: string;
	export let hideName = false;
	export let divClass = '';

	let iconSize = '' as 'xl';

	$: username = $peopleMetadata[pubkey]?.name ?? 'No name';

	$: peopleMetadata.fetchPerson(pubkey);
</script>

<div class="flex flex-col justify-center items-center {divClass}">
	{#if $peopleMetadata[pubkey]}
		<img
			src={$peopleMetadata[pubkey]?.picture}
			alt={username}
			title={nip19.npubEncode(pubkey)}
			class="w-20 h-20 rounded-full object-contain"
		/>
	{:else}
		<div class="w-20">
			<UserSolid size={iconSize} />
		</div>
	{/if}

	{#if !hideName}
		<p title={username} class="text-center w-20 line-clamp-2 break-words">{username}</p>
	{/if}
</div>
