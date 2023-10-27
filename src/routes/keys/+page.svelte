<script lang="ts">
	import { ECPair, NETWORK } from '$lib/pls/multisig';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import type { ECPairInterface } from 'ecpair';
	import { nostrAuth } from '$lib/nostr';

	let wifKey = $nostrAuth?.privkey ?? '';
	let ecpair: ECPairInterface | null = null;

	$: publicKey = ecpair?.publicKey.toString('hex').slice(-64);

	$: {
		try {
			ecpair = ECPair.fromWIF(wifKey, NETWORK);
			nostrAuth.loginWithPrivkey(ecpair.privateKey!.toString('hex'));
		} catch (error) {
			try {
				ecpair = ECPair.fromPrivateKey(Buffer.from(wifKey, 'hex'), { network: NETWORK });
				nostrAuth.loginWithPrivkey(ecpair.privateKey!.toString('hex'));
			} catch (error) {}
		}
	}

	function handleGenerateKeypair() {
		ecpair = ECPair.makeRandom({
			network: NETWORK
		});

		wifKey = ecpair.toWIF();
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(wifKey);
		setTimeout(() => alert('Copied private key to clipboard, store it safely and privately!'), 0);
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<Button on:click={handleGenerateKeypair}>
		<a href="/keys">Generate new keys</a>
	</Button>

	<div class="flex items-end gap-2">
		<LabelledInput type="text" label="Your WIF key or private key" bind:value={wifKey} />
		<Button on:click={copyToClipboard} disabled={wifKey === ''}>📋 Copy</Button>
	</div>

	{#if publicKey}
		<p class="text-center">
			Your public key: <br />
			{publicKey}
		</p>
	{/if}
</div>
