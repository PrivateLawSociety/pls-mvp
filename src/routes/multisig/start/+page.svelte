<script lang="ts">
	import { createBitcoinMultisig, startTxSpendingFromMultisig } from 'pls-bitcoin';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import { tryParseFinishedContract } from '$lib/pls/contract';
	import type { Contract } from 'pls-full';
	import { SpendRequestEvent, type PsbtMetadata, type SpendRequestPayload } from '../shared';
	import { broadcastToNostr, nostrAuth } from '$lib/nostr';
	import { onMount } from 'svelte';
	import { hashFromFile } from '$lib/utils';
	import { createMempoolApi, type UTXO } from '$lib/mempool';
	import { ECPair, getNetworkByName } from '$lib/bitcoin';
	import { contractDataFileStore } from '$lib/stores';
	import {
		createLiquidMultisig,
		getUnblindedUtxoValue,
		startSpendFromLiquidMultisig
	} from 'pls-liquid';
	import DropContract from '$lib/components/DropContract.svelte';

	let utxos: (UTXO & { hex?: string })[] | null = null;

	let contractData: Contract | null = null;
	let contractFile: File | null = null;

	let generatedPSBTsMetadata: PsbtMetadata[] | null = null;

	let addresses: {
		address: string;
		value: number;
	}[] = [
		{
			address: '',
			value: 0
		}
	];

	let timelockDays: number | undefined = undefined;

	let replacingByFee = false;

	$: network = contractData ? getNetworkByName(contractData.collateral.network) : null;
	$: mempool = network ? createMempoolApi(network) : null;

	$: if ($contractDataFileStore) onContractDataFileSelected($contractDataFileStore);

	$: availableBalance = utxos?.reduce((acc, utxo) => acc + utxo.value, 0) ?? 0;

	$: feeAmount = availableBalance - addresses.reduce((acc, cv) => acc + cv.value, 0);

	$: addresses = addresses.filter(({ address }, i) => {
		if (i === addresses.length - 1) return true; // keep last address empty
		else return address.trim() !== ''; // remove every empty address
	});

	$: if (addresses[addresses.length - 1].address.trim() !== '') {
		addresses = [
			...addresses,
			{
				address: '',
				value: 0
			}
		];
	}

	onMount(() => {
		nostrAuth.tryLogin();
	});

	async function onContractDataFileSelected(file: File) {
		contractData = tryParseFinishedContract(await file.text());

		onContractSelected();
	}

	async function onContractSelected() {
		if (!contractData || !mempool) return;

		utxos = await mempool.getAddressUtxos(contractData.collateral.multisigAddress);

		if (getNetworkByName(contractData.collateral.network).isLiquid && utxos) {
			const txHexes = await Promise.all(
				utxos.map((utxo) => mempool.getTransactionHexFromId(utxo.txid))
			);

			utxos = utxos.reduce((acc, utxo, i) => {
				const hex = txHexes[i];

				if (hex) {
					const value = getUnblindedUtxoValue(
						{
							...utxo,
							hex: hex!
						},
						i
					);

					if (value)
						acc.push({
							...utxo,
							hex,
							value
						});
				}

				return acc;
			}, [] as (UTXO & { hex: string; value: number })[]);
		} else {
			const unconfirmedTxs = await mempool.getAddressUnconfirmedTxs(
				contractData.collateral.multisigAddress
			);

			if (!unconfirmedTxs) return;

			const unconfirmedUtxos: UTXO[] = [];

			const address = contractData.collateral.multisigAddress;

			unconfirmedTxs.forEach((tx) =>
				tx.vin
					.filter((vin) => vin.prevout.scriptpubkey_address === address)
					.forEach((vin) => {
						replacingByFee = true;
						return unconfirmedUtxos.push({
							txid: vin.txid,
							value: vin.prevout.value,
							vout: vin.vout
						});
					})
			);

			utxos = [...(utxos ?? []), ...unconfirmedUtxos];
		}
	}

	async function handleStartSpend() {
		if (!contractData || !utxos) return alert("UTXOs haven't loaded yet");

		const signer = nostrAuth.getSigner(contractData.collateral.network);

		if (!signer) return;

		const pubkey = $nostrAuth?.pubkey;

		const { network, isLiquid } = getNetworkByName(contractData.collateral.network);

		if (isLiquid) {
			const { hashTree, multisigScripts } = createLiquidMultisig(
				contractData.collateral.pubkeys.clients,
				contractData.collateral.pubkeys.arbitrators,
				contractData.collateral.arbitratorsQuorum,
				network
			);

			// const unixNow = Math.floor(Date.now() / 1000);
			// const oneDayInSeconds = 60 * 60 * 24;

			const possibleScripts = multisigScripts.filter(({ combination }) =>
				combination.some((ecpair) => ecpair === pubkey)
			);

			generatedPSBTsMetadata = [];

			for (const script of possibleScripts) {
				const redeemOutput = script.leaf.output.toString('hex');

				const psbt = await startSpendFromLiquidMultisig(
					hashTree,
					redeemOutput,
					utxos.map((utxo) => ({
						...utxo,
						hex: utxo.hex!
					})),
					network,
					signer,
					addresses.filter(({ address }) => address.trim() !== '')
					// timelockDays ? unixNow + oneDayInSeconds * timelockDays : undefined
				);
				if (!psbt) return alert("couldn't generate PSETs");

				generatedPSBTsMetadata = [
					...generatedPSBTsMetadata,
					{
						redeemOutput,
						psbtHex: psbt.toBuffer().toString('hex'),
						pubkeys: script.combination
					}
				];
			}
		} else {
			const { multisig, multisigScripts } = createBitcoinMultisig(
				contractData.collateral.pubkeys.clients.map((pubkey) =>
					ECPair.fromPublicKey(Buffer.from('02' + pubkey, 'hex'), { network: network })
				),
				contractData.collateral.pubkeys.arbitrators.map((pubkey) =>
					ECPair.fromPublicKey(Buffer.from('02' + pubkey, 'hex'), { network: network })
				),
				contractData.collateral.arbitratorsQuorum,
				network
			);

			const possibleScripts = multisigScripts.filter(({ combination }) =>
				combination.some((ecpair) => ecpair.publicKey.toString('hex') === '02' + pubkey)
			);

			generatedPSBTsMetadata = [];

			for (const script of possibleScripts) {
				const redeemOutput = script.leaf.output.toString('hex');

				const unixNow = Math.floor(Date.now() / 1000);
				const oneDayInSeconds = 60 * 60 * 24;

				const psbt = await startTxSpendingFromMultisig(
					multisig,
					redeemOutput,
					signer,
					network,
					addresses.filter(({ address }) => address.trim() !== ''),
					utxos,
					timelockDays ? unixNow + oneDayInSeconds * timelockDays : undefined
				);

				generatedPSBTsMetadata = [
					...generatedPSBTsMetadata,
					{
						redeemOutput,
						psbtHex: psbt.toHex(),
						pubkeys: script.combination.map((ecpair) => ecpair.publicKey.toString('hex'))
					}
				];
			}
		}
	}

	function copyToClipboard() {
		if (!generatedPSBTsMetadata) return;

		navigator.clipboard.writeText(JSON.stringify(generatedPSBTsMetadata));
		setTimeout(() => alert('Copied to clipboard'), 0);
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
	{#if generatedPSBTsMetadata}
		<h1 class="text-3xl">Spending initiated</h1>
		<p>Send this to another party so that they can complete the spending:</p>
		<Button on:click={copyToClipboard}>📋 Copy</Button>
		<p>or</p>
		<Button on:click={sendViaNostr}>Send via nostr</Button>
	{:else}
		<h1 class="text-3xl font-bold">Start withdraw from contract</h1>

		{#if contractData}
			<div class="flex gap-4 items-center">
				<p class="text-xl">
					Available balance: {availableBalance === undefined
						? 'Loading...'
						: `${availableBalance} sats`}
				</p>
				{#if replacingByFee}
					<div
						class="px-3 py-2 rounded-lg text-black bg-green-600 font-bold"
						title="This transaction is replacing a previous one"
					>
						RBF
					</div>
				{/if}
			</div>

			<!-- I should implement this for liquid later -->
			{#if !getNetworkByName(contractData.collateral.network).isLiquid}
				{#if timelockDays === undefined}
					<Button on:click={() => (timelockDays = 90)}>Add timelock</Button>
				{:else}
					<LabelledInput
						type="number"
						label="Days until the timelock's unlocked"
						bind:value={timelockDays}
					/>
				{/if}
			{/if}

			{#each addresses as _, i}
				<div class="flex gap-4">
					<LabelledInput
						type="text"
						label="{i + 1}º receiving address"
						bind:value={addresses[i].address}
					/>
					<LabelledInput type="number" label="Amount" bind:value={addresses[i].value} />
				</div>
			{/each}

			<p>Network fee: {feeAmount} sats</p>

			<Button on:click={handleStartSpend}>Start spend</Button>
		{:else}
			<DropContract bind:file={contractFile} bind:contractData />
		{/if}
	{/if}
</div>
