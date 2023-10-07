<script lang="ts">
	import { ECPair, NETWORK, startTxSpendingFromMultisig, type UTXO } from '$lib/bitcoinjs';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import { tryParseFinishedContract, type FinishedContractData } from '$lib/pls/contract';

	let wifKey = '';

	let utxos: UTXO[] | null = null;
	let transactionsHex: string[] | null = null;

	let contractData: FinishedContractData | null = null;

	let myFiles: FileList | undefined;

	let addressQuantity = 1;

	let generatedPsbtHex: string | null = null;

	// let feeAmount = 0;

	let receivingAddresses: {
		address: string;
		amount: number;
	}[] = [];

	$: availableBalance = utxos?.reduce((acc, utxo) => acc + utxo.value, 0);

	$: feeAmount = availableBalance
		? availableBalance - receivingAddresses.reduce((acc, cv) => acc + cv.amount, 0)
		: null;

	$: if (receivingAddresses.length < addressQuantity) {
		receivingAddresses = [
			...receivingAddresses,
			{
				address: '',
				amount: 0
			}
		];
	}

	$: if (receivingAddresses.length > addressQuantity) {
		receivingAddresses = receivingAddresses.filter((_, i) => i !== receivingAddresses.length - 1);
	}

	$: {
		const file = myFiles?.item(0);

		if (file) onFileSelected(file);
	}

	async function onFileSelected(file: File) {
		contractData = tryParseFinishedContract(await file.text());

		if (!contractData) return alert('File has an invalid format');

		utxos = await (
			await fetch(`https://mempool.space/testnet/api/address/${contractData.multisigAddress}/utxo`)
		).json();

		transactionsHex = await Promise.all(
			utxos!.map(async (utxo) =>
				(await fetch(`https://mempool.space/testnet/api/tx/${utxo.txid}/hex`)).text()
			)
		);

		// const fees: { economyFee: number } = await (
		// 	await fetch(`https://mempool.space/testnet/api/v1/fees/recommended`)
		// ).json();

		// feeAmount = fees.economyFee;
	}

	async function handleStartSpend() {
		if (!contractData || !utxos || !transactionsHex) return alert("UTXOs haven't loaded yet");

		generatedPsbtHex = await startTxSpendingFromMultisig(
			contractData.redeemOutput,
			ECPair.fromWIF(wifKey, NETWORK),
			NETWORK,
			receivingAddresses,
			utxos,
			transactionsHex
		);
	}

	function copyToClipboard() {
		if (!generatedPsbtHex) return;

		navigator.clipboard.writeText(generatedPsbtHex);
		setTimeout(() => alert('Copied to clipboard'), 0);
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	{#if generatedPsbtHex}
		<h1 class="text-3xl">Spending initiated</h1>
		<p>Send this to another party so that they can complete the spending:</p>
		<div class="flex items-end gap-2">
			<LabelledInput type="text" label="PSBT" bind:value={generatedPsbtHex} />
			<Button on:click={copyToClipboard}>📋 Copy</Button>
		</div>
	{:else}
		<h1 class="text-3xl font-bold">Start spend from multisig</h1>
		<label class="flex items-center justify-center gap-2">
			Contract data file:
			<input type="file" bind:files={myFiles} />
		</label>

		{#if contractData}
			<p class="text-xl">
				Available balance: {availableBalance === undefined
					? 'Loading...'
					: `${availableBalance} sats`}
			</p>
			<LabelledInput
				type="number"
				label="How many addresses will receive?"
				bind:value={addressQuantity}
			/>

			{#each receivingAddresses as _, i}
				<div class="flex gap-4">
					<LabelledInput
						type="text"
						label="{i + 1}º receiving address"
						bind:value={receivingAddresses[i].address}
					/>
					<LabelledInput type="number" label="Amount" bind:value={receivingAddresses[i].amount} />
				</div>
			{/each}

			<p>Network fee: {feeAmount}</p>

			<LabelledInput type="text" label="Wif key (private key)" bind:value={wifKey} />

			{#if wifKey}
				<Button on:click={handleStartSpend}>Start spend</Button>
			{/if}
		{/if}
	{/if}
</div>
