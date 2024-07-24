<script lang="ts">
	import { broadcastToNostr, nostrAuth, relayList, relayPool } from '$lib/nostr';
	import { onMount } from 'svelte';
	import {
		ContractRequestEvent,
		ContractApprovalEvent,
		type ContractRequestPayload,
		type ContractApprovalPayload
	} from '../shared';

	import { contractSchema, type UnsignedContract } from 'pls-full';

	import { signContract } from '$lib/pls/contract';
	import Button from '$lib/components/Button.svelte';
	import Person from '$lib/components/Person.svelte';
	import { downloadBlob, hashFromFile } from '$lib/utils';
	import { createBitcoinMultisig } from 'pls-bitcoin';
	import { ECPair, NETWORK } from '$lib/bitcoin';
	import { createLiquidMultisig } from 'pls-liquid';
	import DropDocument from '$lib/components/DropDocument.svelte';

	let contractsData: Record<string, UnsignedContract> = {};

	let contractSignatures: Record<string, Record<string, string>> = {};

	let documentFile: File | undefined;
	let documentHash: string | undefined;
	let documentFileName: string | undefined;

	$: if (documentFile)
		hashFromFile(documentFile).then((hash) => {
			documentHash = hash.toString('hex');
			documentFileName = documentFile!.name;
		});

	onMount(async () => {
		if (await nostrAuth.tryLogin()) {
			if (!$nostrAuth?.pubkey) return;

			relayPool.subscribeMany(
				relayList,
				[
					{
						kinds: [ContractRequestEvent],
						'#p': [$nostrAuth.pubkey]
					}
				],
				{
					async onevent(e) {
						const data = JSON.parse(
							await nostrAuth.decryptDM(e.pubkey, e.content)
						) as ContractRequestPayload;

						contractsData[data.fileHash] = {
							collateral: {
								arbitratorsQuorum: data.arbitratorsQuorum,
								multisigAddress: getMultisigAddress({
									arbitrators: data.arbitratorPubkeys,
									arbitratorsQuorum: data.arbitratorsQuorum,
									clients: data.clientPubkeys
								}),
								network: NETWORK.name,
								// TODO TODO TODO
								privateBlindingKey:
									'0000000000000000000000000000000000000000000000000000000000000001',
								pubkeys: {
									clients: data.clientPubkeys,
									arbitrators: data.arbitratorPubkeys
								},
								type: 'taproot-v0'
							},
							communication: {
								identifiers: {
									clients: data.clientPubkeys,
									arbitrators: data.arbitratorPubkeys
								},
								type: 'nostr'
							},
							document: {
								pubkeys: {
									clients: data.clientPubkeys,
									arbitrators: data.arbitratorPubkeys
								},
								fileHash: data.fileHash
							},
							version: 0
						};
					}
				}
			);

			relayPool.subscribeMany(
				relayList,
				[
					{
						kinds: [ContractApprovalEvent],
						'#p': [$nostrAuth.pubkey]
					}
				],
				{
					async onevent(e) {
						const { signature, fileHash } = JSON.parse(
							await nostrAuth.decryptDM(e.pubkey, e.content)
						) as ContractApprovalPayload;

						if (!contractSignatures[fileHash]) contractSignatures[fileHash] = {};

						contractSignatures[fileHash][e.pubkey] = signature;
					}
				}
			);
		}
	});

	async function handleApprove(fileHash: string) {
		if (!$nostrAuth?.pubkey) return;

		const dataToSign = contractsData[fileHash];

		const signer = nostrAuth.getSigner();

		if (!signer) return;

		const signature = (await signContract(signer, dataToSign)).toString('hex');

		const pubkeys = [
			...dataToSign.document.pubkeys.arbitrators,
			...dataToSign.document.pubkeys.clients
		];

		const payload = JSON.stringify({
			signature: signature,
			fileHash
		} satisfies ContractApprovalPayload);

		for (const pubkey of pubkeys) {
			const encryptedText = await nostrAuth.encryptDM(pubkey, payload);

			const event = await nostrAuth.makeEvent(ContractApprovalEvent, encryptedText, [
				['p', pubkey]
			]);

			broadcastToNostr(event);
		}
	}

	// TODO: also check if signature is valid
	function isContractSignedBy(fileHash: string, pubkey: string) {
		for (const [hash, signatures] of Object.entries(contractSignatures)) {
			if (hash !== fileHash) return false;

			if (Object.keys(signatures).includes(pubkey)) {
				return true;
			}
		}

		return false;
	}

	function hasAllSignatures(fileHash: string) {
		if (contractsData[fileHash] === undefined || contractSignatures[fileHash] === undefined)
			return false;

		return [
			...contractsData[fileHash].document.pubkeys.clients,
			...contractsData[fileHash].document.pubkeys.arbitrators
		].every((pubkey) => Object.keys(contractSignatures[fileHash]).includes(pubkey));
	}

	function getMultisigAddress({
		arbitratorsQuorum,
		arbitrators,
		clients
	}: {
		arbitratorsQuorum: number;
		arbitrators: string[];
		clients: string[];
	}) {
		return NETWORK.isLiquid
			? createLiquidMultisig(clients, arbitrators, arbitratorsQuorum, NETWORK.network)
					.confidentialAddress
			: createBitcoinMultisig(
					clients.map((pubkey) => ECPair.fromPublicKey(Buffer.from('02' + pubkey, 'hex'))),
					arbitrators.map((pubkey) => ECPair.fromPublicKey(Buffer.from('02' + pubkey, 'hex'))),
					arbitratorsQuorum,
					NETWORK.network
			  ).multisig.address!;
	}

	function exportContract(fileHash: string) {
		if (!documentFileName) return;

		const parsed = contractSchema.safeParse({
			...contractsData[fileHash],
			signatures: contractSignatures[fileHash]
		});

		const fileName = documentFileName.includes('.')
			? documentFileName.split('.')[0]
			: documentFileName;

		if (parsed.success)
			downloadBlob(new Blob([JSON.stringify(parsed.data, null, 4)]), `${fileName}.json`);

		return parsed;
	}
</script>

<div class="flex justify-center items-center h-full">
	<div class="flex flex-col gap-4 w-1/2">
		{#each Object.values(contractsData) as data}
			<p>Involved clients:</p>
			<div class="flex flex-wrap gap-4">
				{#key contractSignatures}
					{#each data.document.pubkeys.clients as pubkey}
						{@const signed = isContractSignedBy(data.document.fileHash, pubkey)}
						<div class="flex flex-col">
							<Person {pubkey} />

							<span class="text-2xl">{signed ? '✅' : '🕓'}</span>
							<span class="font-bold">{signed ? 'Signed' : 'Waiting'}</span>
						</div>
					{/each}
				{/key}
			</div>
			<p>Involved arbitrators:</p>
			<div class="flex flex-wrap gap-4">
				{#key contractSignatures}
					{#each data.document.pubkeys.arbitrators as pubkey}
						{@const signed = isContractSignedBy(data.document.fileHash, pubkey)}
						<div class="flex flex-col">
							<Person {pubkey} />

							<span class="text-2xl">{signed ? '✅' : '🕓'}</span>
							<span class="font-bold">{signed ? 'Signed' : 'Waiting'}</span>
						</div>
					{/each}
				{/key}
			</div>
			<p>{data.collateral.arbitratorsQuorum} arbitrators need to agree</p>

			<DropDocument bind:file={documentFile} />

			{#if data.document.fileHash === documentHash}
				{#key contractSignatures}
					<Button
						on:click={() => handleApprove(data.document.fileHash)}
						disabled={$nostrAuth
							? isContractSignedBy(data.document.fileHash, $nostrAuth?.pubkey)
							: true}>Approve</Button
					>
				{/key}
			{:else if documentHash !== undefined}
				<p>Contract text doesn't match!</p>
			{/if}

			{#key contractSignatures}
				{#if hasAllSignatures(data.document.fileHash)}
					<Button on:click={() => exportContract(data.document.fileHash)}>Export contract</Button>
				{/if}
			{/key}
		{:else}
			<div class="flex justify-center">
				<p>You have no pending contract requests</p>
			</div>
		{/each}
	</div>
</div>
