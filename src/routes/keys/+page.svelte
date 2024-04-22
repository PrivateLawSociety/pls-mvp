<script lang="ts">
	import type { ECPairInterface } from 'ecpair';
	import { nostrAuth } from '$lib/nostr';
	import { onMount } from 'svelte';
	import { ECPair, NETWORK } from '$lib/bitcoin';
	import { Button } from 'flowbite-svelte';
	import { goto } from '$app/navigation';

	let wifKey = $nostrAuth?.privkey ?? '';
	let ecpair: ECPairInterface | null = null;

	$: publicKey = ecpair?.publicKey.toString('hex').slice(-64);

	$: {
		try {
			ecpair = ECPair.fromWIF(wifKey, NETWORK.network);
			nostrAuth.loginWithPrivkey(ecpair.privateKey!.toString('hex'));
		} catch (error) {
			try {
				ecpair = ECPair.fromPrivateKey(Buffer.from(wifKey, 'hex'), { network: NETWORK.network });
				nostrAuth.loginWithPrivkey(ecpair.privateKey!.toString('hex'));
			} catch (error) {}
		}
	}

	onMount(() => {
		if (window.nostr) nostrAuth.tryLogin();
	});
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	{#if !$nostrAuth?.privkey && $nostrAuth?.pubkey}
		<h1 class="text-3xl text-center">Logged in with nostr browser extension</h1>
	{/if}

	{#if publicKey || $nostrAuth?.pubkey}
		<p class="text-center break-all px-2">
			Your public ID: <br />
			{$nostrAuth?.pubkey}
		</p>

		<Button
			on:click={() => {
				nostrAuth.signOut();
				goto('/');
			}}>Sign out</Button
		>
	{/if}
</div>
