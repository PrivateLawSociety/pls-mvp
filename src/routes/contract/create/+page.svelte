<script lang="ts">
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import Button from '$lib/components/Button.svelte';
	import { hashFromFile } from '$lib/utils';
	import Client from './Client.svelte';
	import Coordinator from './Coordinator.svelte';

	let userType: 'coordinator' | 'client' | null = null;

	let myFiles: FileList | undefined;
	let myFileHash: string;

	let wifKey = '';

	let started = false;

	$: {
		const file = myFiles?.item(0);

		if (file)
			hashFromFile(file).then((hash) => {
				myFileHash = hash.toString('hex');
			});
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	{#if userType === null}
		<h1 class="text-3xl">Which kind of user are you?</h1>
		<Button on:click={() => (userType = 'client')}>Client</Button>
		<Button on:click={() => (userType = 'coordinator')}>Coordinator</Button>
	{:else}
		{#if !started}
			<label class="flex items-center justify-center gap-2">
				Contract file:
				<input type="file" bind:files={myFiles} />
			</label>
			<LabelledInput type="text" label="Your WIF key (private key)" bind:value={wifKey} />
		{/if}

		{#if userType === 'client'}
			<Client {myFileHash} {wifKey} bind:alreadyConnected={started} />
		{:else if userType === 'coordinator'}
			<Coordinator {myFileHash} {wifKey} bind:coordinationStarted={started} />
		{/if}
	{/if}
</div>
