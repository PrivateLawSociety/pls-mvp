<script lang="ts">
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import Button from '$lib/components/Button.svelte';
	import { ECPair, NETWORK, createMultisig } from '$lib/bitcoinjs';
	import type { ECPairInterface } from 'ecpair';

	let publicKeys = ['', '', ''];

	let wifKey = '';
	let publicKey = '';

	function getPublicEcpairs() {
		const ecpairs: ECPairInterface[] = [];

		for (const key of publicKeys) {
			try {
				ecpairs.push(ECPair.fromPublicKey(Buffer.from(key, 'hex')));
			} catch (error) {
				alert('Some of the keys are invalid');
				return null;
			}
		}

		return ecpairs;
	}

	function handleGenerateKeypair() {
		const ecpair = ECPair.makeRandom({
			network: NETWORK
		});

		wifKey = ecpair.toWIF();
		publicKey = ecpair.publicKey.toString('hex');
	}

	function handleGenerateMultisig() {
		const ecpairs = getPublicEcpairs();

		if (!ecpairs) return;

		const multisig = createMultisig(2, ecpairs, NETWORK);

		const address = multisig.address;
		const redeemOutput = multisig.redeem?.output?.toString('hex');

		alert(`Multisig address: ${address}\n\nMultisig redeem output: ${redeemOutput}`);
		console.log(`Multisig address: ${address}\n\nMultisig redeem output: ${redeemOutput}`);
	}
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<Button on:click={handleGenerateKeypair}>Generate keypair</Button>
	<LabelledInput type="text" label="WIF key (private key)" bind:value={wifKey} />
	<LabelledInput type="text" label="Public key" bind:value={publicKey} />

	<h1 class="text-3xl font-bold">Multisig generation</h1>
	<div class="flex flex-col gap-2">
		<LabelledInput type="text" label="First party public key" bind:value={publicKeys[0]} />
		<LabelledInput type="text" label="Second party public key" bind:value={publicKeys[1]} />
		<LabelledInput type="text" label="Arbiter public key" bind:value={publicKeys[2]} />
	</div>
	<Button on:click={handleGenerateMultisig}>Generate</Button>
</div>
