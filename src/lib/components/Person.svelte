<script lang="ts">
	import { peopleMetadata } from '$lib/stores';

	export let pubkey: string;
	export let hideName = false;
	export let divClass = '';

	$: peopleMetadata.fetchPerson(pubkey);
</script>

<div class="flex flex-col justify-center items-center {divClass}">
	<img
		src={$peopleMetadata[pubkey]?.picture ?? '/profile.png'}
		alt={$peopleMetadata[pubkey]?.name ?? 'No name'}
		class="w-20 h-20 rounded-full object-contain"
	/>
	{#if !hideName}
		<p title={pubkey} class="text-center">{$peopleMetadata[pubkey]?.name ?? 'No name'}</p>
	{/if}
</div>
