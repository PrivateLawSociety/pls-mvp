<script lang="ts">
	import { ECPair, NETWORK, startTxSpendingFromMultisig } from '$lib/bitcoinjs';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';

	let wifKey = '';

	let multisigRedeemOutput = '';
	let multisigAddress = '';

	let inputTransactionHash = '';

	let receivingAddress = '';

	let amountToSend = 0;

	async function handleStartSpend() {
		const transactionHex = await (
			await fetch(`https://mempool.space/testnet/api/tx/${inputTransactionHash}/hex`)
		).text();

		const generatedPsbtHex = await startTxSpendingFromMultisig(
			multisigRedeemOutput,
			ECPair.fromWIF(wifKey),
			NETWORK,
			inputTransactionHash,
			transactionHex,
			multisigAddress,
			amountToSend
		);

		alert(`Generated PSBT to be sent to the other party: ${generatedPsbtHex}`);

		console.log(generatedPsbtHex);
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<h1 class="text-3xl font-bold">Start spend from multisig</h1>
	<LabelledInput type="text" label="Wif key (private key)" bind:value={wifKey} />
	<LabelledInput type="text" label="Multisig address" bind:value={multisigRedeemOutput} />
	<LabelledInput type="text" label="Multisig redeem output" bind:value={multisigAddress} />
	<LabelledInput type="text" label="Input transaction hash" bind:value={inputTransactionHash} />
	<LabelledInput type="text" label="Address that will receive" bind:value={receivingAddress} />
	<LabelledInput type="number" label="Amount (remaining is fees)" bind:value={amountToSend} />
	<Button on:click={handleStartSpend}>Start psbt</Button>
</div>
