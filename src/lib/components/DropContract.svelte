<script lang="ts">
	import FileDrop from '$lib/components/FileDrop.svelte';
	import { tryParseFinishedContract } from '$lib/pls/contract';
	import { contractDataFileStore } from '$lib/stores';
	import type { Contract } from 'pls-full';

	let files: FileList | null = null;
	export let contractData: Contract | null = null;
	export let file: File | null = null;

	export let onSelected = () => {};

	$: file = $contractDataFileStore;

	$: if (files && $contractDataFileStore) onSelected();

	$: {
		const newFile = files?.item(0);

		if (newFile) {
			file = newFile;
			onContractDataFileSelected();
		}
	}

	async function onContractDataFileSelected() {
		if (!file) return;

		contractData = tryParseFinishedContract(await file.text());
		$contractDataFileStore = file;

		if (!contractData) {
			$contractDataFileStore = null;
			return alert(
				'Contract is invalid. Do not confuse the contract data (.json) with the document (.txt, .pdf, .docx, etc.)'
			);
		}
	}
</script>

<FileDrop dropText={'Drop your contract JSON here'} bind:files />
