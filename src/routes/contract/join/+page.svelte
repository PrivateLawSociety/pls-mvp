<script lang="ts">
	import { broadcastToNostr, nostrAuth, relayList, relayPool } from '$lib/nostr';
	import { onMount } from 'svelte';
	import {
		ContractRequestEvent,
		ContractApprovalEvent,
		type ContractRequestPayload,
		type ContractApprovalPayload
	} from '../create/shared';
	import { signPartialContract, type PartialContract } from '$lib/pls/contract';
	import Button from '$lib/components/Button.svelte';
	import Person from '$lib/components/Person.svelte';
	import { downloadBlob, hashFromFile } from '$lib/utils';
	import { createBitcoinMultisig } from '$lib/pls/multisig';
	import { ECPair, NETWORK } from '$lib/bitcoin';
	import FileDrop from '$lib/components/FileDrop.svelte';
	import { createLiquidMultisig } from '$lib/liquid';

	let contractsData: Record<string, PartialContract> = {};

	let contractSignatures: Record<string, Record<string, string>> = {};

	let myFiles: FileList | undefined;
	let myFileHash: string | undefined;

	$: {
		const file = myFiles?.item(0);

		if (file)
			hashFromFile(file).then((hash) => {
				myFileHash = hash.toString('hex');
			});
	}

	onMount(async () => {
		if (await nostrAuth.tryLogin()) {
			if (!$nostrAuth?.pubkey) return;

			relayPool
				.sub(relayList, [
					{
						kinds: [ContractRequestEvent],
						'#p': [$nostrAuth.pubkey]
					}
				])
				.on('event', async (e) => {
					const data = JSON.parse(
						await nostrAuth.decryptDM(e.pubkey, e.content)
					) as ContractRequestPayload;

					contractsData[data.fileHash] = data;
				});

			relayPool
				.sub(relayList, [
					{
						kinds: [ContractApprovalEvent],
						'#p': [$nostrAuth.pubkey]
					}
				])
				.on('event', async (e) => {
					const { signature, fileHash } = JSON.parse(
						await nostrAuth.decryptDM(e.pubkey, e.content)
					) as ContractApprovalPayload;

					if (!contractSignatures[fileHash]) contractSignatures[fileHash] = {};

					contractSignatures[fileHash][e.pubkey] = signature;
				});
		}
	});

	async function handleApprove(fileHash: string) {
		if (!$nostrAuth?.pubkey) return;

		const dataToSign = contractsData[fileHash];

		const signer = nostrAuth.getSigner();

		if (!signer) return;

		const signature = (await signPartialContract(signer, dataToSign)).toString('hex');

		const pubkeys = [...dataToSign.arbitratorPubkeys, ...dataToSign.clientPubkeys];

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
			...contractsData[fileHash].clientPubkeys,
			...contractsData[fileHash].arbitratorPubkeys
		].every((pubkey) => Object.keys(contractSignatures[fileHash]).includes(pubkey));
	}

	function exportContract(fileHash: string) {
		const { arbitratorPubkeys, arbitratorsQuorum, clientPubkeys } = contractsData[fileHash];
		const multisigAddress = NETWORK.isLiquid
			? createLiquidMultisig(clientPubkeys, arbitratorPubkeys, arbitratorsQuorum, NETWORK.network)
					.confidentialAddress
			: createBitcoinMultisig(
					clientPubkeys.map((pubkey) => ECPair.fromPublicKey(Buffer.from('02' + pubkey, 'hex'))),
					arbitratorPubkeys.map((pubkey) =>
						ECPair.fromPublicKey(Buffer.from('02' + pubkey, 'hex'))
					),
					arbitratorsQuorum,
					NETWORK.network
			  ).multisig.address;

		const finishedContract = {
			arbitratorPubkeys,
			arbitratorsQuorum,
			clientPubkeys,
			fileHash: myFileHash,
			multisigAddress: multisigAddress,
			signatures: contractSignatures[fileHash]
		};

		downloadBlob(new Blob([JSON.stringify(finishedContract, null, 4)]))

		return finishedContract;
	}
</script>

<div class="flex justify-center items-center h-full">
	<div class="flex flex-col gap-4 w-1/2">
		{#each Object.values(contractsData) as data}
			<p>Involved clients:</p>
			<div class="flex flex-wrap gap-4">
				{#key contractSignatures}
					{#each data.clientPubkeys as pubkey}
						{@const signed = isContractSignedBy(data.fileHash, pubkey)}
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
					{#each data.arbitratorPubkeys as pubkey}
						{@const signed = isContractSignedBy(data.fileHash, pubkey)}
						<div class="flex flex-col">
							<Person {pubkey} />

							<span class="text-2xl">{signed ? '✅' : '🕓'}</span>
							<span class="font-bold">{signed ? 'Signed' : 'Waiting'}</span>
						</div>
					{/each}
				{/key}
			</div>
			<p>{data.arbitratorsQuorum} arbitrators need to agree</p>

			<FileDrop dropText={'Drop contract text here'} bind:files={myFiles} />

			{#if data.fileHash === myFileHash}
				{#key contractSignatures}
					<Button
						on:click={() => handleApprove(data.fileHash)}
						disabled={$nostrAuth ? isContractSignedBy(data.fileHash, $nostrAuth?.pubkey) : true}
						>Approve</Button
					>
				{/key}
			{:else if myFileHash !== undefined}
				<p>Contract text doesn't match!</p>
			{/if}

			{#key contractSignatures}
				{#if hasAllSignatures(data.fileHash)}
					<Button on:click={() => exportContract(data.fileHash)}>Export contract</Button>
				{/if}
			{/key}
		{:else}
			<div class="flex justify-center">
				<p>You have no pending contract requests</p>
			</div>
		{/each}
	</div>
</div>
