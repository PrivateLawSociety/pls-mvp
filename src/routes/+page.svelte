<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import FileDrop from '$lib/components/FileDrop.svelte';
	import { contractDataFileStore } from '$lib/stores';

	let files: FileList | undefined;

	$: {
		const file = files?.item(0);

		if (file) {
			$contractDataFileStore = file;
			goto('/contract/verify');
		}
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<Button>
		<a href="/contract/create">Create contract</a>
	</Button>
	<p>Or</p>
	<Button>
		<a href="/contract/join">Join a contract</a>
	</Button>
	<p>Or</p>
	<p>if you already have a contract, view its options here:</p>
	<FileDrop dropText={'Drop contract data here'} bind:files />
</div>
