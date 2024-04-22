<script lang="ts">
	import { goto } from '$app/navigation';
	import { nostrAuth } from '$lib/nostr';
	import { Button, P } from 'flowbite-svelte';

	async function useAlby() {
		try {
			await window.nostr!.getPublicKey();

			nostrAuth.tryLogin();
			goto('/');
		} catch (error) {
			alert("You haven't allowed Alby to connect with the app");
		}
	}
</script>

<div class="flex flex-col justify-center h-full gap-4 p-4">
	<div class="flex justify-center">
		<P size="4xl" weight="normal">PLS Identity</P>
	</div>

	<div class="flex flex-col justify-center items-center h-full gap-4">
		<a href="/start/new">
			<Button class="w-48 md:w-64">New</Button>
		</a>
		<a href="/start/import">
			<Button class="w-48 md:w-64">Import / Recover</Button>
		</a>
		{#if window.nostr}
			<Button class="w-48 md:w-64" on:click={useAlby}>Use alby</Button>
		{/if}
	</div>
</div>
