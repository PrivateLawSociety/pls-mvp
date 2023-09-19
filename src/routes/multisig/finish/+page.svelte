<script>
	import { ECPair, NETWORK, finishTxSpendingFromMultisig } from '$lib/bitcoinjs';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';

	let wifKey = '';
	let psbtHex = '';

	async function handleFinishSpend() {
		const generatedTransactionHex = await finishTxSpendingFromMultisig(
			psbtHex,
			ECPair.fromWIF(wifKey, NETWORK)
		);

		alert(`Generated transaction that can be published to testnet: ${generatedTransactionHex}`);

		console.log(generatedTransactionHex);
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<h1 class="text-3xl font-bold">Finish spend from multisig</h1>
	<LabelledInput type="text" label="WIF key (private key)" bind:value={wifKey} />
	<LabelledInput type="text" label="PSBT hex" bind:value={psbtHex} />
	<Button on:click={handleFinishSpend}>Finish transaction</Button>
</div>
