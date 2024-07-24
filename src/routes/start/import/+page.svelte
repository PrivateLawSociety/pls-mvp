<script lang="ts">
	import { ECPair, NETWORK } from '$lib/bitcoin';
	import { nostrAuth } from '$lib/nostr';
	import type { ECPairInterface } from 'ecpair';
	import { Button, Input, Label, P } from 'flowbite-svelte';
	import { nip19 } from 'nostr-tools';

	let secretKey = $nostrAuth?.privkey ?? '';
	let ecpair: ECPairInterface | null = null;

	$: privateKey = ecpair?.privateKey!.toString('hex')!;

	// TODO: do this better
	$: {
		try {
			ecpair = ECPair.fromWIF(secretKey, NETWORK.network);
			nostrAuth.loginWithPrivkey(ecpair.privateKey!.toString('hex'));
		} catch (error) {
			try {
				ecpair = ECPair.fromPrivateKey(Buffer.from(secretKey, 'hex'), { network: NETWORK.network });
				nostrAuth.loginWithPrivkey(ecpair.privateKey!.toString('hex'));
			} catch (error) {
				try {
					let nsec = nip19.decode(secretKey);

					if (nsec.type == 'nsec') {
						ecpair = ECPair.fromPrivateKey(Buffer.from(nsec.data), {
							network: NETWORK.network
						});
						nostrAuth.loginWithPrivkey(ecpair.privateKey!.toString('hex'));
					} else {
						ecpair = null;
					}
				} catch (error) {
					ecpair = null;
				}
			}
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
			<Input type="text" bind:value={secretKey} />
		</div>
	</div>
	<a href="/">
		<Button disabled={!ecpair?.publicKey} on:click={() => nostrAuth.loginWithPrivkey(privateKey)}
			>Continue</Button
		>
	</a>
</div>
