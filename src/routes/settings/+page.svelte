<script>
	import { NETWORK, getNetworkName } from '$lib/bitcoin';
	import { P, Select } from 'flowbite-svelte';
	// import { Dropdown, DropdownItem } from 'flowbite-svelte';
	// import { ChevronDownOutline } from 'flowbite-svelte-icons';

	let isTestnet = NETWORK.isTestnet;

	let networkName = getNetworkName();
</script>

<div class="flex flex-col justify-center h-full gap-4 p-4">
	<div class="flex justify-center">
		<P size="4xl" weight="normal">Settings</P>
	</div>

	<div class="w-full flex flex-col items-center h-full gap-4">
		{#if !isTestnet}
			<h1 class="font-bold text-center text-md bg-[#ff0000] p-4 rounded-lg">
				☣️ This is ALPHA SOFTWARE, you may lose your bitcoins. Use at your own risk.
			</h1>
		{/if}

		<div>
			<Select
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
			</Select>
		</div>

		<!-- <div class="text-center">
			<Button>Language<ChevronDownOutline class="w-6 h-6 ms-2 text-white dark:text-white" /></Button
			>
			<Dropdown>
				<DropdownItem>English</DropdownItem>
				<DropdownItem>Portuguese</DropdownItem>
			</Dropdown>
		</div> -->
	</div>
</div>
