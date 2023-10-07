<script lang="ts">
	import { ECPair, NETWORK, createMultisig } from '$lib/bitcoinjs';
	import Button from '$lib/components/Button.svelte';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import { broadcastToNostr, makeNostrEvent, nostrNow, nostrSubscribe } from '$lib/nostr';
	import { nip04 } from 'nostr-tools';
	import {
		BitcoinToNostrPubkey,
		FirstEvent,
		SecondEvent,
		type FirstEventPayload,
		type SecondEventPayload,
		type ThirdEventPayload,
		ThirdEvent
	} from './shared';
	import { signPartialContract } from '$lib/pls/contract';

	export let myFileHash: string;
	export let wifKey: string;

	let publicKey = '';

	let collectedBitcoinPubkeys: string[] = [];
	let collectedSignatures: Record<string, string> = {};

	let alreadyStartedMultisig = false;
	let coordinationStarted = false;

	async function handleStartCoordination() {
		const myPrivKey = ECPair.fromWIF(wifKey, NETWORK)?.privateKey?.toString('hex');

		if (!myPrivKey) return;

		const myBitcoinPubkey = ECPair.fromWIF(wifKey, NETWORK).publicKey.toString('hex');

		const myNostrPubkey = BitcoinToNostrPubkey(myBitcoinPubkey);

		nostrSubscribe([
			{
				kinds: [FirstEvent],
				'#p': [myNostrPubkey],
				since: nostrNow()
			}
		]).on('event', async (e) => {
			if (e.kind === FirstEvent) {
				const { fileHash: otherFileHash, pubkey: otherBitcoinPubkey } = JSON.parse(
					await nip04.decrypt(myPrivKey, e.pubkey, e.content)
				) as FirstEventPayload;

				if (myFileHash !== otherFileHash)
					return alert(`${otherBitcoinPubkey} tried connecting, but they sent the wrong file`);

				collectedBitcoinPubkeys = [...collectedBitcoinPubkeys, otherBitcoinPubkey];
			}
		});

		coordinationStarted = true;
	}

	async function handleStartMultisig() {
		const myKeypair = ECPair.fromWIF(wifKey, NETWORK);
		const myPrivkey = myKeypair.privateKey?.toString('hex');
		const myPubkey = myKeypair.publicKey?.toString('hex');
		const myNostrPubkey = BitcoinToNostrPubkey(myPubkey);

		if (!myPrivkey) return;

		const multisigPubkeys = [myPubkey, ...collectedBitcoinPubkeys];
		const multisigECPairs = multisigPubkeys.map((pubkey) =>
			ECPair.fromPublicKey(Buffer.from(pubkey, 'hex'))
		);

		const multisig = createMultisig(2, multisigECPairs, NETWORK);
		const address = multisig.address;
		const redeemOutput = multisig.redeem?.output?.toString('hex');

		for (const bitcoinPubkey of collectedBitcoinPubkeys) {
			const otherNostrPubkey = BitcoinToNostrPubkey(bitcoinPubkey);

			const encryptedText = await nip04.encrypt(
				myPrivkey,
				otherNostrPubkey,
				JSON.stringify({
					pubkeys: multisigPubkeys
				} satisfies SecondEventPayload)
			);

			const event = await makeNostrEvent(myPrivkey, SecondEvent, encryptedText, [
				['p', otherNostrPubkey]
			]);

			broadcastToNostr(event);
		}

		nostrSubscribe([
			{
				kinds: [ThirdEvent],
				'#p': [myNostrPubkey],
				since: nostrNow()
			}
		]).on('event', async (e) => {
			const { signature } = JSON.parse(
				await nip04.decrypt(myPrivkey, e.pubkey, e.content)
			) as ThirdEventPayload;

			const bitcoinPubkey = collectedBitcoinPubkeys.find(
				(pubkey) => BitcoinToNostrPubkey(pubkey) == e.pubkey
			);

			if (!bitcoinPubkey) return;

			if (!collectedBitcoinPubkeys.includes(bitcoinPubkey)) return;

			collectedSignatures[bitcoinPubkey] = signature;

			if (Object.values(collectedSignatures).length === collectedBitcoinPubkeys.length) {
				const mySignature = signPartialContract(myKeypair, {
					fileHash: myFileHash,
					pubkeys: multisigPubkeys
				}).toString('hex');

				const finalStuff = {
					fileHash: myFileHash,
					redeemOutput: redeemOutput,
					multisigAddress: address,
					pubkeys: multisigPubkeys,
					signatures: { [myPubkey]: mySignature, ...collectedSignatures }
				};

				console.log(finalStuff);
				alert(JSON.stringify(finalStuff));
			}
		});

		alreadyStartedMultisig = true;
	}
</script>

<LabelledInput type="text" label="Your public key" bind:value={publicKey} />
{#if !coordinationStarted}
	<Button on:click={handleStartCoordination}>Start coordination</Button>
{/if}

{#if collectedBitcoinPubkeys.length != 0}
	<p>Collected client pubkeys:</p>
	{#each collectedBitcoinPubkeys as pubkey}
		<p>{pubkey}</p>
	{/each}
	{@const remainingSignatures =
		collectedBitcoinPubkeys.length - Object.values(collectedSignatures).length}
	<Button disabled={alreadyStartedMultisig} on:click={handleStartMultisig}>
		Request approval
		{alreadyStartedMultisig ? `(${remainingSignatures} remaining)` : ''}
	</Button>
{/if}
