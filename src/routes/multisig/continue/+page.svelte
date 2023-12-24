<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import { Psbt } from 'bitcoinjs-lib';
	import { SpendRequestEvent, type PsbtMetadata, type SpendRequestPayload } from '../shared';
	import { nostrAuth, relayList, relayPool } from '$lib/nostr';
	import { onMount } from 'svelte';
	import { formatDateTime, hashFromFile } from '$lib/utils';
	import { publishTransaction } from '$lib/mempool';
	import { ECPair, NETWORK } from '$lib/bitcoin';
	import { contractDataFileStore } from '$lib/stores';
	import FileDrop from '$lib/components/FileDrop.svelte';
	import { Pset, address, bip341 } from 'liquidjs-lib';
	import {
		createLiquidMultisig,
		finalizeTxSpendingFromLiquidMultisig,
		getTapscriptSigsOrdered,
		signTaprootTransaction
	} from '$lib/liquid';
	import { tryParseFinishedContract, type FinishedContractData } from '$lib/pls/contract';

	let psbtsMetadataStringified = '';

	export let psbtsMetadata: PsbtMetadata[] | null = null;

	let generatedPSBTsMetadata: PsbtMetadata[] | null = null;
	let generatedTransactionHex: string | null = null;

	let contractData: FinishedContractData | null = null;

	let myFiles: FileList | undefined;

	if ($contractDataFileStore) onFileSelected($contractDataFileStore);

	$: {
		const file = myFiles?.item(0);

		if (file) onFileSelected(file);
	}

	$: userShownData = getUserShownData(psbtsMetadata);

	function getUserShownData(_: any) {
		if (!psbtsMetadata) return null;

		if (NETWORK.isLiquid) {
			const pset = Pset.fromBuffer(Buffer.from(psbtsMetadata[0].psbtHex, 'hex'));

			const network = NETWORK.network;

			return {
				outputs: pset.outputs
					.filter(({ script }) => script?.length !== 0)
					.map(({ value, script, blindingPubkey }) => {
						const addresss = address.fromOutputScript(script!, network);

						return {
							value,
							address: address.toConfidential(addresss, blindingPubkey!)
						};
					}),
				locktime: pset.locktime()
			};
		} else {
			const psbt = Psbt.fromHex(psbtsMetadata[0].psbtHex, { network: NETWORK.network });

			return {
				outputs: psbt.txOutputs,
				locktime: psbt.locktime
			};
		}
	}

	let transactionLocktime: number | null = null;

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

	async function onFileSelected(file: File) {
		contractData = tryParseFinishedContract(await file.text());

		if (!contractData) return alert('File has an invalid format');

		if (file && $nostrAuth?.pubkey) {
			relayPool
				.sub(relayList, [
					{
						kinds: [SpendRequestEvent],
						'#h': [(await hashFromFile(file)).toString('hex')]
					}
				])
				.on('event', async (e) => {
					const { psbtsMetadata } = JSON.parse(e.content) as SpendRequestPayload;

					psbtsMetadataStringified = JSON.stringify(psbtsMetadata);
				});
		}
	}

	// for security reasons, check if all PSBTs are equivalent before signing
	function areAllPsbtsEquivalent(psbtsMetadata: PsbtMetadata[]) {
		if (psbtsMetadata.length === 1) return true;

		if (NETWORK.isLiquid) {
			const firstPsetMetadata = psbtsMetadata[0];
			const firstPset = Pset.fromBuffer(Buffer.from(firstPsetMetadata.psbtHex, 'hex'));

			return psbtsMetadata
				.map(({ psbtHex }) => Pset.fromBuffer(Buffer.from(psbtHex, 'hex')))
				.every((pset) =>
					pset.outputs.every((output, i) => {
						return (
							output.script?.toString('hex') == firstPset.outputs[i].script?.toString('hex') &&
							output.value == firstPset.outputs[i].value
						);
					})
				);
		} else {
			const firstPsbtMetadata = psbtsMetadata[0];
			const firstPsbt = Psbt.fromHex(firstPsbtMetadata.psbtHex);

			return psbtsMetadata.every(({ psbtHex }) =>
				Psbt.fromHex(psbtHex).txOutputs.every(
					(output, i) =>
						output.address === firstPsbt.txOutputs[i].address &&
						output.value === firstPsbt.txOutputs[i].value
				)
			);
		}
	}

	async function handleApproveTransaction() {
		if (!psbtsMetadata || !contractData) return;

		const pubkey = $nostrAuth?.pubkey;

		if (!pubkey) return;

		const signer = nostrAuth.getSigner();

		if (!signer) return;

		if (NETWORK.isLiquid) {
			const { multisigScripts } = createLiquidMultisig(
				contractData.clientPubkeys,
				contractData.arbitratorPubkeys,
				contractData.arbitratorsQuorum,
				NETWORK.network
			);

			generatedPSBTsMetadata = await Promise.all(
				psbtsMetadata
					.filter(({ pubkeys }) => pubkeys.includes(pubkey))
					.map(async (metadata) => {
						if (!NETWORK.isLiquid) throw new Error('Network is not liquid');

						const redeemOutput = multisigScripts
							.find(({ combination }) =>
								combination.sort().every((pubkey, i) => pubkey === metadata.pubkeys.sort()[i])
							)
							?.leaf.output.toString('hex');

						if (!redeemOutput) throw new Error('No redeem output');

						const pset = Pset.fromBuffer(Buffer.from(metadata.psbtHex, 'hex'));

						const leafHash = bip341.tapLeafHash({
							scriptHex: redeemOutput
						});

						await signTaprootTransaction(pset, signer, leafHash, NETWORK.network);

						return {
							...metadata,
							psbtHex: pset.toBuffer().toString('hex')
						};
					})
			);

			if (generatedPSBTsMetadata.length === 1) {
				const pset = Pset.fromBuffer(Buffer.from(generatedPSBTsMetadata[0].psbtHex, 'hex'));

				const { clientSigs, arbitratorSigs } = getTapscriptSigsOrdered(
					pset,
					contractData.clientPubkeys,
					contractData.arbitratorPubkeys
				);

				const clientSigAmount = clientSigs.reduce((acc, sig) => (sig ? acc + 1 : acc), 0);
				const arbitratorSigAmount = arbitratorSigs.reduce((acc, sig) => (sig ? acc + 1 : acc), 0);

				if (
					clientSigAmount == 2 ||
					(clientSigAmount == 1 && arbitratorSigAmount >= contractData.arbitratorsQuorum)
				) {
					const tx = finalizeTxSpendingFromLiquidMultisig(pset, clientSigs, arbitratorSigs);

					generatedTransactionHex = tx.toHex();
				}
			}
		} else {
			generatedPSBTsMetadata = await Promise.all(
				psbtsMetadata
					.filter(({ pubkeys }) => '02' + pubkeys.includes(pubkey))
					.map(async (metadata) => {
						const psbt = Psbt.fromHex(metadata.psbtHex, { network: NETWORK.network });

						await psbt.signAllInputsAsync(signer);

						return {
							...metadata,
							psbtHex: psbt.toHex()
						};
					})
			);

			// There's only one spending possibility left, so the tx can be finished
			if (generatedPSBTsMetadata.length === 1) {
				const psbt = Psbt.fromHex(generatedPSBTsMetadata[0].psbtHex, { network: NETWORK.network });

				psbt.finalizeAllInputs();

				const tx = psbt.extractTransaction();

				if (tx.locktime !== 0) transactionLocktime = tx.locktime;

				generatedTransactionHex = tx.toHex();
			}
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

	async function publish() {
		if (!generatedTransactionHex) return;

		publishTransaction(generatedTransactionHex);
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	{#if !generatedPSBTsMetadata && !psbtsMetadata}
		<h1 class="text-3xl font-bold">Continue spend from multisig</h1>
		<LabelledInput type="text" label="PSBT hex" bind:value={psbtsMetadataStringified} />
		{#if !myFiles?.length && !$contractDataFileStore}
			<p>or from nostr:</p>
			<FileDrop dropText={'Drop contract data here'} bind:files={myFiles} />
		{:else}
			<p>Waiting for a nostr event</p>
		{/if}
	{/if}

	{#if generatedTransactionHex}
		<h1 class="text-3xl">Transaction created</h1>
		<!-- TODO: don't show this button if transaction has timelock -->
		<Button on:click={publish}>🚀 Publish</Button>
		<Button on:click={copyTransactionToClipboard}>📋 Copy</Button>
	{:else if generatedPSBTsMetadata}
		<h1 class="text-3xl">PSBT created</h1>
		<p>Send this to another party so that they can continue the spending</p>
		<Button on:click={copyPsbtsToClipboard}>📋 Copy</Button>
	{:else if userShownData}
		<!-- it's safe to get only the first one because we already checked that all PSBTs are equivalent -->
		{#each userShownData.outputs as output}
			<p>{output.address} receives {output.value}</p>
		{/each}
		{#if userShownData.locktime !== 0}
			<p>timelock: {formatDateTime(new Date(userShownData.locktime * 1000))}</p>
		{/if}
		<Button on:click={handleApproveTransaction}>Approve transaction</Button>
	{:else if psbtsMetadataStringified != ''}
		<p>Invalid PSBT</p>
	{/if}
</div>
