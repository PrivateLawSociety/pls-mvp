<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import { Psbt } from 'bitcoinjs-lib';
	import { SpendRequestEvent, type PsbtMetadata, type SpendRequestPayload } from '../shared';
	import { broadcastToNostr, nostrAuth, relayList, relayPool } from '$lib/nostr';
	import { onMount } from 'svelte';
	import { formatDateTime, hashFromFile } from '$lib/utils';
	import { createMempoolApi } from '$lib/mempool';
	import { contractDataFileStore } from '$lib/stores';
	import FileDrop from '$lib/components/FileDrop.svelte';
	import { Pset, address, bip341 } from 'liquidjs-lib';
	import {
		createLiquidMultisig,
		finalizeTxSpendingFromLiquidMultisig,
		getTapscriptSigsOrdered,
		signTaprootTransaction
	} from 'pls-liquid';
	import type { Contract } from 'pls-full';
	import DropDocument from '$lib/components/DropDocument.svelte';
	import { tryParseFinishedContract } from '$lib/pls/contract';
	import { getNetworkByName } from '$lib/bitcoin';

	let psbtsMetadataStringified = '';

	export let psbtsMetadata: PsbtMetadata[] | null = null;

	let generatedPSBTsMetadata: PsbtMetadata[] | null = null;
	let generatedTransactionHex: string | null = null;

	let contractData: Contract | null = null;
	let contractFile: File | null;
	let psbtFiles: FileList | null;

	$: network = contractData ? getNetworkByName(contractData.collateral.network) : null;
	$: mempool = network ? createMempoolApi(network) : null;

	$: {
		const file = psbtFiles?.item(0);

		if (file) file.text().then((text) => (psbtsMetadataStringified = text));
	}

	$: if (contractData) onContractSelected();

	$: userShownData = getUserShownData();

	$: if ($contractDataFileStore) onContractDataFileSelected($contractDataFileStore);

	async function onContractDataFileSelected(file: File) {
		contractData = tryParseFinishedContract(await file.text());
	}

	function getUserShownData() {
		if (!psbtsMetadata || !contractData) return null;

		// TODO: checck if this works
		const { isLiquid, network } = getNetworkByName(contractData.collateral.network);

		if (isLiquid) {
			const pset = Pset.fromBuffer(Buffer.from(psbtsMetadata[0].psbtHex, 'hex'));

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
			const psbt = Psbt.fromHex(psbtsMetadata[0].psbtHex, { network: network });

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

	async function onContractSelected() {
		if (!contractFile) return;
		if (!$nostrAuth?.pubkey) return;

		relayPool.subscribeMany(
			relayList,
			[
				{
					kinds: [SpendRequestEvent],
					'#h': [(await hashFromFile(contractFile)).toString('hex')]
				}
			],
			{
				onevent(e) {
					const { psbtsMetadata } = JSON.parse(e.content) as SpendRequestPayload;

					psbtsMetadataStringified = JSON.stringify(psbtsMetadata);
				}
			}
		);
	}

	// for security reasons, check if all PSBTs are equivalent before signing
	function areAllPsbtsEquivalent(psbtsMetadata: PsbtMetadata[]) {
		if (psbtsMetadata.length === 1) return true;
		if (contractData === null) return false;

		const { isLiquid } = getNetworkByName(contractData.collateral.network);

		if (isLiquid) {
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

		const {
			isLiquid,
			network,
			name: networkName
		} = getNetworkByName(contractData?.collateral.network);

		const signer = nostrAuth.getSigner(networkName);

		if (!signer) return;

		if (isLiquid) {
			const { multisigScripts } = createLiquidMultisig(
				contractData.collateral.pubkeys.clients,
				contractData.collateral.pubkeys.arbitrators,
				contractData.collateral.arbitratorsQuorum,
				network
			);

			generatedPSBTsMetadata = await Promise.all(
				psbtsMetadata
					.filter(({ pubkeys }) => pubkeys.includes(pubkey))
					.map(async (metadata) => {
						if (!isLiquid) throw new Error('Network is not liquid');

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

						await signTaprootTransaction(pset, signer, leafHash, network);

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
					contractData.collateral.pubkeys.clients,
					contractData.collateral.pubkeys.arbitrators
				);

				const clientSigAmount = clientSigs.reduce((acc, sig) => (sig ? acc + 1 : acc), 0);
				const arbitratorSigAmount = arbitratorSigs.reduce((acc, sig) => (sig ? acc + 1 : acc), 0);

				if (
					clientSigAmount == 2 ||
					(clientSigAmount == 1 && arbitratorSigAmount >= contractData.collateral.arbitratorsQuorum)
				) {
					const tx = finalizeTxSpendingFromLiquidMultisig(pset, clientSigs, arbitratorSigs);

					generatedTransactionHex = tx.toHex();
				}
			}
		} else {
			generatedPSBTsMetadata = await Promise.all(
				psbtsMetadata
					.filter(({ pubkeys }) => pubkeys.includes('02' + pubkey))
					.map(async (metadata) => {
						const psbt = Psbt.fromHex(metadata.psbtHex, { network: network });

						await psbt.signAllInputsAsync(signer);

						return {
							...metadata,
							psbtHex: psbt.toHex()
						};
					})
			);

			// There's only one spending possibility left, so the tx can be finished
			if (generatedPSBTsMetadata.length === 1) {
				const psbt = Psbt.fromHex(generatedPSBTsMetadata[0].psbtHex, { network: network });

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
		if (!generatedTransactionHex || !mempool) return;

		mempool.publishTransaction(generatedTransactionHex);
	}

	async function sendViaNostr() {
		if (!generatedPSBTsMetadata) return;
		if (!contractFile) return;

		const payload = JSON.stringify({
			psbtsMetadata: generatedPSBTsMetadata
		} as SpendRequestPayload);

		const event = await nostrAuth.makeEvent(SpendRequestEvent, payload, [
			['h', (await hashFromFile(contractFile)).toString('hex')]
		]);

		broadcastToNostr(event);
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	{#if !generatedPSBTsMetadata && !psbtsMetadata}
		<h1 class="text-3xl font-bold">Continue spend from multisig</h1>
		<LabelledInput type="text" label="PSBT hex" bind:value={psbtsMetadataStringified} />
		<p>or</p>
		<FileDrop dropText={'Drop PSBT here'} bind:files={psbtFiles} />
		{#if !contractFile && !$contractDataFileStore}
			<p>or from nostr:</p>
			<DropDocument bind:file={contractFile} />
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
		<p>or</p>
		<Button on:click={sendViaNostr}>Send via nostr</Button>
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
