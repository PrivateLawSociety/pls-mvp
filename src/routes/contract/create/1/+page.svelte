<script lang="ts">
	import { Radio, Button, P } from 'flowbite-svelte';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { NewContractData } from '../shared';

	let newContract = getContext<Writable<NewContractData>>('contract');

	let networkName = $newContract.network ?? 'bitcoin_testnet';

	$: $newContract.network = networkName;
</script>

<P class="text-2xl">Select network</P>

<div class="flex flex-col gap-4 items-center justify-center h-full">
	<ul
		class="w-48 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-600 divide-y divide-gray-200 dark:divide-gray-600"
	>
		<li><Radio class="p-3" bind:group={networkName} value="bitcoin">Bitcoin</Radio></li>
		<li>
			<Radio class="p-3" bind:group={networkName} value="bitcoin_testnet">Bitcoin Testnet</Radio>
		</li>
		<li><Radio class="p-3" bind:group={networkName} value="liquid">Liquid</Radio></li>
		<li>
			<Radio class="p-3" bind:group={networkName} value="liquid_testnet">Liquid Testnet</Radio>
		</li>
	</ul>

	{#if !networkName.includes('testnet')}
		<h1 class="font-bold text-center text-md bg-[#ff0000] p-4 rounded-lg">
			☣️ ALPHA SOFTWARE. You may lose your bitcoins. Use at your own risk.
		</h1>
	{/if}
</div>

<a href="/contract/create/2">
	<Button class="w-48 md:w-52">Next</Button>
</a>
