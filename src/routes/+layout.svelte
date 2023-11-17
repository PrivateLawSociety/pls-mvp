<script lang="ts">
	import '../app.postcss';
	import { isMainnet } from '$lib/bitcoin';
	import Person from '$lib/components/Person.svelte';
	import { nostrAuth } from '$lib/nostr';

	let network = isMainnet() ? 'mainnet' : 'testnet';
</script>

<div class="flex flex-col h-screen">
	<div class="flex items-center justify-center gap-4 w-full p-2">
		{#if $nostrAuth?.pubkey}
			<a href="/keys">
				<Person hideName pubkey={$nostrAuth?.pubkey} />
			</a>
		{/if}
		<a class="text-3xl text-center cursor-pointer" href="/">🏠</a>
		{#if network === 'mainnet'}
			<h1 class="font-bold text-3xl bg-[#ff0000]">☣️ ALPHA ⚠️ SOFTWARE ☢️</h1>
		{/if}
		<select
			class="text-black"
			bind:value={network}
			on:change={() => {
				sessionStorage.setItem('network', network);
				location.reload();
			}}
		>
			<option value={'mainnet'}> Mainnet </option>
			<option value={'testnet'}> Testnet </option>
		</select>
	</div>
	<slot />
</div>
