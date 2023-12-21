<script lang="ts">
	import { tryParseFinishedContract, type FinishedContractData } from '$lib/pls/contract';
	import { contractDataFileStore } from '$lib/stores';
	import qrcode from 'qrcode-generator';

	let contractData: FinishedContractData | null = null;

	if ($contractDataFileStore) onContractDataFileSelected($contractDataFileStore);

	async function onContractDataFileSelected(file: File) {
		contractData = tryParseFinishedContract(await file.text());

		if (!contractData) return alert('File has an invalid format');
	}

	function qrToImgTag(str: string) {
		const qr = qrcode(12, 'H');

		qr.addData(str);
		qr.make();

		return qr.createDataURL();
	}
</script>

<div class="flex flex-col justify-center items-center h-screen w-full gap-4">
	{#if contractData?.multisigAddress}
		{@const addressUrl = 'bitcoin:' + contractData.multisigAddress}
		<h1 class="text-3xl font-bold">Deposit collateral to multisig</h1>
		<a class="w-1/2 h-1/2" href={addressUrl}>
			<img class="w-full h-full object-contain" src={qrToImgTag(addressUrl)} alt="" />
		</a>
		<p class="break-all">{contractData.multisigAddress}</p>
	{:else}
		<p>No contract</p>
	{/if}
</div>

<style>
	img {
		image-rendering: pixelated;
	}
</style>
