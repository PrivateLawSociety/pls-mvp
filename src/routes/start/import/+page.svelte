<script lang="ts">
	import { ECPair } from '$lib/bitcoin';
	import { nostrAuth } from '$lib/nostr';
	import { Buffer } from 'buffer';
	import { Button, Input, Label, P } from 'flowbite-svelte';
	import { nip19 } from 'nostr-tools';

	let nsecInput = '';

	let secretKey: Uint8Array | null = null;

	let secretKeyStr: string | null = '';

	$: {
		try {
			let nsec = nip19.decode(nsecInput);

			if (nsec.type == 'nsec') {
				let ecpair = ECPair.fromPrivateKey(Buffer.from(nsec.data));

				secretKey = new Uint8Array(ecpair.privateKey?.buffer!);

				secretKeyStr = ecpair.privateKey?.toString('hex')!;
			} else {
				secretKey = null;
				secretKeyStr = null;
			}
		} catch (error) {
			secretKey = null;
			secretKeyStr = null;
		}
	}
</script>

<div class="w-full flex flex-col justify-center items-center h-full gap-4 p-4">
	<div class="flex justify-center">
		<P align="center" size="4xl" weight="normal">Import PLS Identity</P>
	</div>

	<div class="flex justify-center w-full flex-col items-center h-full gap-4">
		<div>
			<Label class="mb-2">Secret key</Label>
			<Input type="text" bind:value={nsecInput} />
		</div>
	</div>
	<a href="/">
		<Button
			disabled={secretKeyStr == null}
			on:click={() => {
				if (secretKeyStr) nostrAuth.loginWithPrivkey(secretKeyStr);
			}}>Continue</Button
		>
	</a>
</div>
