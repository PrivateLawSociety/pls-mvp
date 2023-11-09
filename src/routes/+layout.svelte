<script lang="ts">
	import '../app.postcss';
	import { isMainnet } from '$lib/bitcoin';

	let network = isMainnet() ? 'mainnet' : 'testnet';
</script>

<div class="flex flex-col h-screen">
	<div class="flex items-center justify-center gap-4 w-full p-2">
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
