<script lang="ts">
	import '../app.postcss';
	import { getNetworkName, NETWORK } from '$lib/bitcoin';
	import Person from '$lib/components/Person.svelte';
	import { nostrAuth } from '$lib/nostr';

	let isTestnet = NETWORK.isTestnet;

	let networkName = getNetworkName();
</script>

<div class="flex flex-col h-screen">
	<div class="flex items-center justify-center gap-4 w-full p-2">
		{#if $nostrAuth?.pubkey}
			<a href="/keys">
				<Person hideName pubkey={$nostrAuth?.pubkey} />
			</a>
		{/if}
		<a class="text-3xl text-center cursor-pointer" href="/">🏠</a>
		{#if !isTestnet}
			<h1 class="font-bold text-3xl bg-[#ff0000]">☣️ ALPHA ⚠️ SOFTWARE ☢️</h1>
		{/if}
		<select
			class="text-black"
			bind:value={networkName}
			on:change={() => {
				sessionStorage.setItem('network', networkName);
				location.reload();
			}}
		>
			<option value={'bitcoin'}> Bitcoin </option>
			<option value={'bitcoin_testnet'}> Bitcoin Testnet </option>
			<option value={'liquid'}> Liquid </option>
			<option value={'liquid_testnet'}> Liquid Testnet </option>
		</select>
	</div>
	<slot />
</div>
