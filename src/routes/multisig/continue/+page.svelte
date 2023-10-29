<script lang="ts">
	import { NETWORK } from '$lib/pls/multisig';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import { Psbt } from 'bitcoinjs-lib';
	import type { PsbtMetadata } from '../shared';
	import { nostrAuth } from '$lib/nostr';
	import { onMount } from 'svelte';

	let psbtsMetadataStringified = '';

	export let psbtsMetadata: PsbtMetadata[] | null = null;

	let generatedPSBTsMetadata: PsbtMetadata[] | null = null;
	let generatedTransactionHex: string | null = null;

	$: {
		try {
			psbtsMetadata = JSON.parse(psbtsMetadataStringified) as PsbtMetadata[];

			if (!areAllPsbtsEquivalent(psbtsMetadata)) {
				psbtsMetadata = null;
				alert('PSBTs are not equivalent! This may either be a bug or a malicious actor');
			}
		} catch (error) {
			psbtsMetadata = null;
		}
	}

	onMount(() => {
		nostrAuth.tryLogin();
	});

	// for security reasons, check if all PSBTs are equivalent before signing them
	function areAllPsbtsEquivalent(psbtsMetadata: PsbtMetadata[]) {
		let firstPsbtMetadata = psbtsMetadata[0];
		const firstPsbt = Psbt.fromHex(firstPsbtMetadata.psbtHex);

		return psbtsMetadata.every(({ psbtHex }) =>
			Psbt.fromHex(psbtHex).txOutputs.every(
				(output, i) =>
					output.address === firstPsbt.txOutputs[i].address &&
					output.value === firstPsbt.txOutputs[i].value
			)
		);
	}

	async function handleApproveTransaction() {
		if (!psbtsMetadata) return;

		const pubkey = $nostrAuth?.pubkey;

		const signer = nostrAuth.getSigner();

		if (!signer) return;

		generatedPSBTsMetadata = await Promise.all(
			psbtsMetadata
				.filter(({ pubkeys }) => pubkeys.includes('02' + pubkey))
				.map(async (metadata) => {
					const psbt = Psbt.fromHex(metadata.psbtHex, { network: NETWORK });

					await psbt.signAllInputsAsync(signer);

					return {
						...metadata,
						psbtHex: psbt.toHex()
					};
				})
		);

		// There's only one spending possibility left, so the tx can be finished
		if (generatedPSBTsMetadata.length === 1) {
			const psbt = Psbt.fromHex(generatedPSBTsMetadata[0].psbtHex, { network: NETWORK });

			psbt.finalizeAllInputs();

			const tx = psbt.extractTransaction();

			generatedTransactionHex = tx.toHex();
		}
	}

	function copyTransactionToClipboard() {
		if (!generatedTransactionHex) return;

		navigator.clipboard.writeText(generatedTransactionHex);
		setTimeout(() => alert('Copied to clipboard'), 0);
	}

	function copyPsbtsToClipboard() {
		if (!generatedPSBTsMetadata) return;

		navigator.clipboard.writeText(JSON.stringify(generatedPSBTsMetadata));
		setTimeout(() => alert('Copied to clipboard'), 0);
	}

	async function publishTransaction() {
		if (!generatedTransactionHex) return;

		try {
			const req = await fetch('https://mempool.space/testnet/api/tx', {
				method: 'POST',
				body: generatedTransactionHex
			});

			const text = await req.text();

			if (req.status === 200) {
				alert(`Transaction published! TxId: ${text}`);
			} else {
				alert(`Error: ${text}`);
			}
		} catch (error) {
			alert(
				'Error while publishing! Try disabling your adblocker/tracker blocker or try using another browser'
			);
		}
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	{#if !generatedPSBTsMetadata}
		<h1 class="text-3xl font-bold">Continue spend from multisig</h1>
		<LabelledInput type="text" label="PSBT hex" bind:value={psbtsMetadataStringified} />
	{/if}

	{#if generatedTransactionHex}
		<h1 class="text-3xl">Transaction created</h1>
		<Button on:click={publishTransaction}>🚀 Publish</Button>
		<Button on:click={copyTransactionToClipboard}>📋 Copy</Button>
	{:else if generatedPSBTsMetadata}
		<h1 class="text-3xl">PSBT created</h1>
		<p>Send this to another party so that they can continue the spending</p>
		<Button on:click={copyPsbtsToClipboard}>📋 Copy</Button>
	{:else if psbtsMetadata}
		<!-- it's safe to get only the first one because we already checked that all PSBTs are equivalent -->
		{#each Psbt.fromHex(psbtsMetadata[0].psbtHex, { network: NETWORK }).txOutputs as output}
			<p>{output.address} receives {output.value}</p>
		{/each}
		<Button on:click={handleApproveTransaction}>Approve transaction</Button>
	{:else if psbtsMetadataStringified != ''}
		<p>Invalid PSBT</p>
	{/if}
</div>
