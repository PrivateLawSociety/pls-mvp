<script lang="ts">
	import '../app.postcss';
	import { getNetworkName, NETWORK } from '$lib/bitcoin';
	import Person from '$lib/components/Person.svelte';
	import { nostrAuth } from '$lib/nostr';
	import Button from '$lib/components/Button.svelte';
	import { page } from '$app/stores';

	let isTestnet = NETWORK.isTestnet;

	let networkName = getNetworkName();
</script>

<div class="flex flex-col h-screen">
	<div class="m-0 grid grid-cols-3 px-2">
		<div class="place-self-center justify-self-start">
			{#if $nostrAuth?.pubkey}
				<a href="/keys">
					<Person hideName pubkey={$nostrAuth?.pubkey} />
				</a>
			{/if}
		</div>
		<div class="flex items-center justify-center gap-4 w-full p-2">
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
		<div class="place-self-center justify-self-end">
			{#if $page.url.pathname === '/'}
				<a
					href="https://github.com/PrivateLawSociety/pls-mvp/blob/main/README.md"
					target="_blank"
					rel="noopener noreferrer"><Button>Guide</Button></a
				>
			{/if}
		</div>
	</div>

	<slot />
</div>
