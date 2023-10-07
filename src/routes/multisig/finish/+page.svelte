<script lang="ts">
	import { ECPair, NETWORK, bitcoinjs, finishTxSpendingFromMultisig } from '$lib/bitcoinjs';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import type { Psbt } from 'bitcoinjs-lib';

	let wifKey = '';
	let psbtHex = '';

	let PsbtData: Psbt | null = null;

	let generatedTransactionHex: string | null = null;

	$: {
		try {
			PsbtData = bitcoinjs.Psbt.fromHex(psbtHex, { network: NETWORK });
		} catch (error) {
			PsbtData = null;
		}
	}

	async function handleApproveTransaction() {
		if (!PsbtData) return;

		generatedTransactionHex = await finishTxSpendingFromMultisig(
			PsbtData,
			ECPair.fromWIF(wifKey, NETWORK)
		);
	}

	function copyToClipboard() {
		if (!generatedTransactionHex) return;

		navigator.clipboard.writeText(generatedTransactionHex);
		setTimeout(() => alert('Copied to clipboard'), 0);
	}

	function publishTransaction() {
		if (!generatedTransactionHex) return;

		fetch('https://mempool.space/testnet/api/tx', {
			method: 'POST',
			body: generatedTransactionHex
		});
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<h1 class="text-3xl font-bold">Finish spend from multisig</h1>
	<LabelledInput type="text" label="PSBT hex" bind:value={psbtHex} />
	{#if generatedTransactionHex}
		<h1 class="text-3xl">Transaction created</h1>
		<Button on:click={publishTransaction}>🚀 Publish</Button>
		<Button on:click={copyToClipboard}>📋 Copy</Button>
	{:else if PsbtData}
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
