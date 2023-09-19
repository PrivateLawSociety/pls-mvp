<script lang="ts">
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import Button from '$lib/components/Button.svelte';
	import { ECPair, NETWORK, createMultisig, createTxSpendingFromMultisig } from '$lib/bitcoinjs';
	import type { ECPairInterface } from 'ecpair';

	// Keys can be generated as such:
	// ECPair.makeRandom({
	// 	network: NETWORK
	// }).toWIF()
	let wifKeys = [
		'cPiYkuFSBCewtdoMfAczLmicmdeRFaUTmA3ffzmDzvSK92fQ8DW5',
		'cS7G2pcTPAY4T2p9xZ1ozAZzjVmPB5W1TopzhYG9LD6MqQpnyCGd',
		'cTyrP7qb93MwxNK5ANLmaLUcRMAbp6ZuEtKaTsrX85H5Dc4B257L'
	];

	let inputTransactionHash = '0bb4b8592d23d08345e31cc221546c8731d5ca2a21aeac5f6407677199cb738a';

	let receivingAddress = '2Myd7Cxtxfju6CjxiuooTeyFfieYisx7S7e';

	let amountToSend = 500;

	// let files: FileList | undefined;

	// $: if (files) alert(files.item(0)?.name);

	function getEcpairs() {
		const ecpairs: ECPairInterface[] = [];

		for (const key of wifKeys) {
			try {
				ecpairs.push(ECPair.fromWIF(key, NETWORK));
			} catch (error) {
				alert('Some of the keys are invalid');
				return null;
			}
		}

		return ecpairs;
	}

	async function handleDoOtherStuff() {
		const ecpairs = getEcpairs();

		if (!ecpairs) return;

		const transactionHex = await (
			await fetch(`https://mempool.space/testnet/api/tx/${inputTransactionHash}/hex`)
		).text();

		const multisig = createMultisig(2, ecpairs, NETWORK);

		const generatedTransactionInHex = await createTxSpendingFromMultisig(
			multisig,
			ecpairs,
			NETWORK,
			inputTransactionHash,
			transactionHex,
			multisig.address!,
			546 - 338
		);

		alert(`Generated transaction that can be published to testnet: ${generatedTransactionInHex}`);
	}

	function handleGenerate() {
		const ecpairs = getEcpairs();

		if (!ecpairs) return;

		const multisig = createMultisig(2, ecpairs, NETWORK);

		alert(`Multisig address: ${multisig.address}`);
	}
</script>

<div class="flex flex-col items-center justify-center w-full gap-4">
	<!-- <input type="file" bind:files /> -->
	<h1 class="text-3xl font-bold">**Using bitcoin testnet**</h1>
	<h1 class="text-3xl font-bold">Multisig generation</h1>
	<div class="flex flex-col gap-2">
		<LabelledInput type="text" label="First party pubkey" bind:value={wifKeys[0]} />
		<LabelledInput type="text" label="Second party pubkey" bind:value={wifKeys[1]} />
		<LabelledInput type="text" label="Arbiter pubkey" bind:value={wifKeys[2]} />
	</div>
	<Button on:click={handleGenerate}>Generate</Button>

	<h1 class="text-3xl font-bold">Spend from multisig</h1>
	<LabelledInput type="text" label="Input transaction hash" bind:value={inputTransactionHash} />
	<LabelledInput type="text" label="Output address" bind:value={receivingAddress} />
	<LabelledInput type="number" label="Amount (remaining is fees)" bind:value={amountToSend} />
	<Button on:click={handleDoOtherStuff}>Create tx</Button>
</div>
