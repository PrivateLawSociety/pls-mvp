<script lang="ts">
	import { ECPair, NETWORK, bitcoinjs, finishTxSpendingFromMultisig } from '$lib/bitcoinjs';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import type { Psbt } from 'bitcoinjs-lib';

	let wifKey = '';
	let psbtHex = '';

	let PsbtData: Psbt | null = null;

	$: {
		try {
			PsbtData = bitcoinjs.Psbt.fromHex(psbtHex, { network: NETWORK });
		} catch (error) {}
	}

	async function handleApproveTransaction() {
		if (!PsbtData) return;

		const generatedTransactionHex = await finishTxSpendingFromMultisig(
			PsbtData,
			ECPair.fromWIF(wifKey, NETWORK)
		);

		alert(`Generated transaction that can be published to testnet: ${generatedTransactionHex}`);
		console.log(generatedTransactionHex);
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<h1 class="text-3xl font-bold">Finish spend from multisig</h1>
	<LabelledInput type="text" label="PSBT hex" bind:value={psbtHex} />
	{#if PsbtData}
		{#each PsbtData.txOutputs as output}
			<p>{output.address} receives {output.value}</p>
		{/each}
		<LabelledInput type="text" label="WIF key (private key)" bind:value={wifKey} />
		{#if wifKey}
			<Button on:click={handleApproveTransaction}>Approve transaction</Button>
		{/if}
	{:else if psbtHex != ''}
		<p>Invalid PSBT</p>
	{/if}
</div>
