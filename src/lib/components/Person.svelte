<script lang="ts">
	import { peopleMetadata } from '$lib/stores';

	export let pubkey: string;
	export let hideName = false;

	$: peopleMetadata.fetchPerson(pubkey);
</script>

<img
	src={$peopleMetadata[pubkey]?.picture ?? '/profile.png'}
	alt={$peopleMetadata[pubkey]?.name ?? 'No name'}
	class="w-20 h-20 rounded-full object-contain"
/>
{#if !hideName}
	<p title={pubkey}>{$peopleMetadata[pubkey]?.name ?? 'No name'}</p>
{/if}
