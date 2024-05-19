<script lang="ts">
	import { page } from '$app/stores';

	$: step = Number($page.route.id?.split('/').at(-1));

	import { P } from 'flowbite-svelte';
	import { setContext } from 'svelte';
	import { type Writable, writable } from 'svelte/store';
	import type { NewContractData } from './shared';

	let newContract = writable({});

	setContext<Writable<NewContractData>>('contract', newContract);
</script>

<div class="flex flex-col justify-center items-center h-full m-8 mt-0">
	<div class="flex flex-col justify-center items-center">
		<P size="3xl" weight="bold">Create Contract</P>
		{#if step}
			<P size="2xl" weight="bold">{step}/5</P>
		{/if}
	</div>

	<slot />
</div>
