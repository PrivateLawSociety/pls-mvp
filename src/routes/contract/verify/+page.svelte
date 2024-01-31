<script lang="ts">
	import { tryParseFinishedContract, verifyContract } from '$lib/pls/contract';
	import type { Contract } from 'pls-full';
	import { hashFromFile } from '$lib/utils';
	import Person from '$lib/components/Person.svelte';
	import { ECPair } from '$lib/bitcoin';
	import { contractDataFileStore } from '$lib/stores';
	import FileDrop from '$lib/components/FileDrop.svelte';
	import Button from '$lib/components/Button.svelte';

	export let contractDataFiles: FileList | undefined;

	let contractTextFile: FileList | undefined;
	let contractTextHash: string;

	let contractData: Contract | null = null;

	if ($contractDataFileStore) onContractDataFileSelected($contractDataFileStore);

	$: {
		const file = contractDataFiles?.item(0);

		if (file) onContractDataFileSelected(file);
	}

	$: {
		const file = contractTextFile?.item(0);

		if (file)
			hashFromFile(file).then((hash) => {
				contractTextHash = hash.toString('hex');
			});
	}

	async function onContractDataFileSelected(file: File) {
		contractData = tryParseFinishedContract(await file.text());
	}

	function isSignatureValid(contractData: Contract, pubkey: string) {
		const ecpair = ECPair.fromPublicKey(Buffer.from('02' + pubkey, 'hex'));
		const signature = contractData.signatures[pubkey];

		if (!signature) return false;

		const isValid = verifyContract(ecpair, contractData, Buffer.from(signature, 'hex'));

		return isValid;
	}
</script>

<div
	class="flex flex-col justify-center items-center h-screen w-full gap-4 {contractData
		? ''
		: 'justify-center'}"
>
	{#if contractData}
		<div class="flex justify-center flex-wrap gap-4 sm:gap-16">
			<div class="flex flex-col text-center gap-2">
				<p class="text-xl">Clients:</p>
				<div class="flex flex-wrap gap-4">
					{#each contractData.document.pubkeys.clients as pubkey}
						{@const valid = isSignatureValid(contractData, pubkey)}
						<div class="flex flex-col items-center">
							<Person {pubkey} />
							<p>
								<span class="text-2xl">{valid ? '✅' : '❌'}</span>
								<span class="font-bold">{valid ? 'Signed' : 'Unsigned'}</span>
							</p>
						</div>
					{/each}
				</div>
			</div>

			<div class="flex flex-col text-center gap-2">
				<p class="text-xl">Arbitrators:</p>
				<div class="flex flex-wrap gap-4">
					{#each contractData.document.pubkeys.arbitrators as pubkey}
						{@const valid = isSignatureValid(contractData, pubkey)}
						<div class="flex flex-col">
							<Person {pubkey} />
							<p>
								<span class="text-2xl">{valid ? '✅' : '❌'}</span>
								<span class="font-bold">{valid ? 'Signed' : 'Invalid'}</span>
							</p>
						</div>
					{/each}
				</div>
			</div>
		</div>

		{@const quorum = contractData.collateral.arbitratorsQuorum}

		<p>
			{quorum}
			{quorum == 1 ? 'arbitrator' : 'arbitrators'} constitute{quorum == 1 ? 's' : ''} a decision
		</p>

		{@const valid = contractData.document.fileHash === contractTextHash}
		{#if !contractTextHash || !valid}
			<FileDrop dropText={'Drop contract text here'} bind:files={contractTextFile} />
		{/if}
		{#if contractTextFile}
			<p>
				<span class="text-2xl">{valid ? '✅' : '❌'}</span>
				Contract text
				<span class="font-bold">{valid ? 'matches' : `doesn't match`}</span>
			</p>
		{/if}

		<div class="flex gap-4">
			<a href="/multisig/deposit">
				<Button>Deposit collateral</Button>
			</a>
		</div>

		<div class="flex gap-4">
			<a href="/multisig/start">
				<Button>Start decision</Button>
			</a>

			<a href="/multisig/continue">
				<Button>Approve decision</Button>
			</a>
		</div>
	{:else}
		<FileDrop dropText={'Drop contract data file here'} bind:files={contractDataFiles} />
	{/if}
</div>
