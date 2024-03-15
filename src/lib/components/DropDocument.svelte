<script lang="ts">
	import FileDrop from './FileDrop.svelte';

	let myFiles: FileList | null;

	export let file: File | null = null;
	export let onFileSelected = (file: File) => {};

	$: {
		const newFile = myFiles?.item(0);

		if (newFile) {
			file = newFile;
			onFileSelected(newFile);
		}
	}
</script>

<FileDrop dropText={'Drop the contract file here (txt, pdf, word file)'} bind:files={myFiles} />
