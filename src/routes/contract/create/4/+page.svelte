<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { Button, Dropzone, P } from 'flowbite-svelte';
	import type { NewContractData } from '../shared';
	import { hashFromFile } from '$lib/utils';

	const newContract = getContext<Writable<NewContractData>>('contract');

	let fileList: FileList | undefined;
	$: file = fileList?.item(0);

	$: if (file) {
		$newContract.fileName = file?.name;
		hashFromFile(file).then((hash) => {
			$newContract.fileHash = hash.toString('hex');
		});
	}

	function dropHandle(e: DragEvent) {
		e.preventDefault();

		const files = e.dataTransfer?.files;

		if (files?.length !== 1) return alert('aspiodjoasjdis');

		const newFile = files.item(0)!;

		file = newFile;
	}
</script>

<P class="text-2xl">Select document file</P>

<div class="flex flex-col justify-center items-center gap-8 h-full">
	<Dropzone
		defaultClass="flex flex-col justify-center items-center w-64 h-32 p-4 bg-gray-50 rounded-lg border-2 border-gray-300 border-dashed cursor-pointer dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600"
		bind:files={fileList}
		on:drop={dropHandle}
		on:dragover={(e) => e.preventDefault()}
	>
		<svg
			aria-hidden="true"
			class="mb-3 w-10 h-10 text-gray-400"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			><path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
			/></svg
		>
		{#if $newContract.fileName}
			<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
				<span class="font-semibold">File: </span>
				{$newContract.fileName}
			</p>
		{:else}
			<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
				<span class="font-semibold">Click to upload</span> or drag and drop
			</p>
			<p class="text-xs text-gray-500 dark:text-gray-400">
				.docx, .pdf, .txt, or any other file type.
			</p>
		{/if}
	</Dropzone>
</div>
<a href="/contract/create/5">
	<Button class="w-48 md:w-52" disabled={!$newContract.fileHash}>Next</Button>
</a>
