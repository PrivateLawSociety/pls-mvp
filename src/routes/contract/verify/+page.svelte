<script lang="ts">
	import { ECPair } from '$lib/bitcoinjs';
	import {
		tryParseFinishedContract,
		type FinishedContractData,
		verifyPartialContract
	} from '$lib/pls/contract';
	import { hashFromFile } from '$lib/utils';

	let contractDataFile: FileList | undefined;

	let contractTextFile: FileList | undefined;
	let contractTextHash: string;

	let contractData: FinishedContractData | null = null;

	$: {
		const file = contractDataFile?.item(0);

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

		if (!contractData) return alert('File has an invalid format');
	}

	function isSignatureValid(contractData: FinishedContractData, pubkey: string) {
		const ecpair = ECPair.fromPublicKey(Buffer.from(pubkey, 'hex'));
		const signature = contractData.signatures[pubkey];
		const isValid = verifyPartialContract(ecpair, contractData, Buffer.from(signature, 'hex'));

		return isValid;
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<h1 class="text-3xl font-bold">Verify contract</h1>
	<label class="flex items-center justify-center gap-2">
		Contract data file:
		<input type="file" bind:files={contractDataFile} />
	</label>
	{#if contractData}
		<p>Multisig address: {contractData.multisigAddress}</p>
		{#each contractData.pubkeys as pubkey}
			{@const valid = isSignatureValid(contractData, pubkey)}
			<p>
				{pubkey}: <span class="text-2xl">{valid ? '✅' : '❌'}</span>
				<span class="font-bold">{valid ? 'Valid' : 'Invalid'} signature</span>
			</p>
		{/each}

		<label class="flex items-center justify-center gap-2">
			Contract text file:
			<input type="file" bind:files={contractTextFile} />
		</label>

		{#if contractTextFile}
			{@const valid = contractData.fileHash === contractTextHash}
			<p>
				<span class="text-2xl">{valid ? '✅' : '❌'}</span>
				Contract text
				<span class="font-bold">{valid ? 'matches' : `doesn't match`}</span>
			</p>
		{/if}
	{/if}
</div>