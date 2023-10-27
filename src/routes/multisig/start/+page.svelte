<script lang="ts">
	import {
		createMultisig,
		ECPair,
		NETWORK,
		startTxSpendingFromMultisig,
		type UTXO
	} from '$lib/pls/multisig';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import { tryParseFinishedContract, type FinishedContractData } from '$lib/pls/contract';
	import type { PsbtMetadata } from '../shared';

	let wifKey = '';

	let utxos: UTXO[] | null = null;
	let transactionsHex: string[] | null = null;

	let contractData: FinishedContractData | null = null;

	let myFiles: FileList | undefined;

	let addressQuantity = 1;

	let generatedPSBTsMetadata: PsbtMetadata[] | null = null;

	// let feeAmount = 0;

	let receivingAddresses: {
		address: string;
		value: number;
	}[] = [];

	$: availableBalance = utxos?.reduce((acc, utxo) => acc + utxo.value, 0);

	$: feeAmount = availableBalance
		? availableBalance - receivingAddresses.reduce((acc, cv) => acc + cv.value, 0)
		: null;

	$: if (receivingAddresses.length < addressQuantity) {
		receivingAddresses = [
			...receivingAddresses,
			{
				address: '',
				value: 0
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

		const { multisig, multisigScripts } = createMultisig(
			contractData.clientPubkeys.map((pubkey) =>
				ECPair.fromPublicKey(Buffer.from('02' + pubkey, 'hex'), { network: NETWORK })
			),
			contractData.arbitratorPubkeys.map((pubkey) =>
				ECPair.fromPublicKey(Buffer.from('02' + pubkey, 'hex'), { network: NETWORK })
			),
			contractData.arbitratorsQuorum,
			NETWORK
		);

		const myPubkey = ECPair.fromWIF(wifKey, NETWORK).publicKey;

		const possibleScripts = multisigScripts.filter(({ combination }) =>
			combination.some((ecpair) => ecpair.publicKey.toString('hex') === myPubkey.toString('hex'))
		);

		generatedPSBTsMetadata = [];

		for (const script of possibleScripts) {
			const redeemOutput = script.leaf.output.toString('hex');

			generatedPSBTsMetadata = [
				...generatedPSBTsMetadata,
				{
					redeemOutput,
					psbtHex: startTxSpendingFromMultisig(
						multisig,
						redeemOutput,
						ECPair.fromWIF(wifKey, NETWORK),
						NETWORK,
						receivingAddresses,
						utxos
					).toHex(),
					pubkeys: script.combination.map((ecpair) => ecpair.publicKey.toString('hex'))
				}
			];
		}
	}

	function copyToClipboard() {
		if (!generatedPSBTsMetadata) return;

		navigator.clipboard.writeText(JSON.stringify(generatedPSBTsMetadata));
		setTimeout(() => alert('Copied to clipboard'), 0);
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	{#if generatedPSBTsMetadata}
		<h1 class="text-3xl">Spending initiated</h1>
		<p>Send this to another party so that they can complete the spending:</p>
		<div class="flex items-end gap-2">
			<LabelledInput type="text" label="PSBT" value={JSON.stringify(generatedPSBTsMetadata)} />
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
					<LabelledInput type="number" label="Amount" bind:value={receivingAddresses[i].value} />
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
