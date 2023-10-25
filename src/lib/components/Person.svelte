<script lang="ts">
	import { peopleMetadata } from '$lib/stores';

	export let pubkey: string;
</script>

<img
	src={$peopleMetadata[pubkey]?.picture}
	alt={$peopleMetadata[pubkey]?.name}
	class="w-20 h-20 rounded-full object-contain"
/>
<p title={pubkey}>{$peopleMetadata[pubkey]?.name}</p>
