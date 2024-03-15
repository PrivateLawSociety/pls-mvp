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
			{#if $page.url.pathname != '/'}
			<a class="text-lg text-center cursor-pointer" href="/">Home</a>
			{/if}
			{#if !isTestnet}
				<h1 class="font-bold text-md bg-[#ff0000]">☣️ ALPHA SOFTWARE</h1>
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
	<hr class="border-t border-gray-600 mt-8 mb-2" />

	<footer class="p-4 bg-gray-800 text-white">
    <div class="flex justify-center space-x-4">
        <a href="https://www.privatelawsociety.net/join" target="_blank" rel="noopener noreferrer">Discord</a>
        <a href="https://twitter.com/PrivateLawSoc" target="_blank" rel="noopener noreferrer">Twitter</a>
        <a href="https://www.youtube.com/@privatelawsociety" target="_blank" rel="noopener noreferrer">Youtube</a>
				<a href="https://github.com/PrivateLawSociety/" target="_blank" rel="noopener noreferrer">Github</a>
    </div>
</footer>
</div>
