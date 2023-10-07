<script lang="ts">
	import { ECPair, NETWORK } from '$lib/bitcoinjs';
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
	import { broadcastToNostr, makeNostrEvent, nostrNow, nostrSubscribe } from '$lib/nostr';
	import { signPartialContract, type PartialContract } from '$lib/pls/contract';
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import Button from '$lib/components/Button.svelte';

	export let myFileHash: string;
	export let wifKey: string;
	export let alreadyConnected: boolean;

	let alreadyApproved = false;

	let coordinatorBitcoinPubkey = '';

	let dataToSign: PartialContract | null = null;

	async function handleConnectToCoordinator() {
		const myKeypair = ECPair.fromWIF(wifKey, NETWORK);
		const myPrivKey = myKeypair.privateKey?.toString('hex');
		const myBitcoinPubKey = myKeypair.publicKey.toString('hex');

		const myNostrPubkey = BitcoinToNostrPubkey(myBitcoinPubKey);

		if (!myPrivKey) return;

		const encryptedText = await nip04.encrypt(
			myPrivKey,
			BitcoinToNostrPubkey(coordinatorBitcoinPubkey),
			JSON.stringify({
				pubkey: myBitcoinPubKey,
				fileHash: myFileHash
			} satisfies FirstEventPayload)
		);

		const event = await makeNostrEvent(myPrivKey, FirstEvent, encryptedText, [
			['p', BitcoinToNostrPubkey(coordinatorBitcoinPubkey)]
		]);

		broadcastToNostr(event);

		nostrSubscribe([
			{
				authors: [BitcoinToNostrPubkey(coordinatorBitcoinPubkey)],
				'#p': [myNostrPubkey],
				kinds: [SecondEvent],

				since: nostrNow()
			}
		]).on('event', async (e) => {
			const { pubkeys } = JSON.parse(
				await nip04.decrypt(myPrivKey, e.pubkey, e.content)
			) as SecondEventPayload;

			dataToSign = {
				fileHash: myFileHash,
				pubkeys: pubkeys
			};
		});

		alreadyConnected = true;
	}

	async function handleApprove() {
		const myKeypair = ECPair.fromWIF(wifKey, NETWORK);
		const myPrivkey = myKeypair.privateKey?.toString('hex');

		if (!dataToSign || !myPrivkey) return;

		const signature = signPartialContract(myKeypair, dataToSign).toString('hex');

		const encryptedText = await nip04.encrypt(
			myPrivkey,
			BitcoinToNostrPubkey(coordinatorBitcoinPubkey),
			JSON.stringify({
				signature: signature
			} satisfies ThirdEventPayload)
		);

		const event = await makeNostrEvent(myPrivkey, ThirdEvent, encryptedText, [
			['p', BitcoinToNostrPubkey(coordinatorBitcoinPubkey)]
		]);

		broadcastToNostr(event);

		alreadyApproved = true;
	}
</script>

{#if !alreadyConnected}
	<LabelledInput type="text" label="Coordinator public key" bind:value={coordinatorBitcoinPubkey} />
{/if}

{#if dataToSign}
	{#if alreadyApproved}
		<p>Process finished, ask the coordinator for the contract file</p>
	{:else}
		<p>Involved parties:</p>
		{#each dataToSign.pubkeys as pubkey}
			<p>{pubkey}</p>
		{/each}

		<Button disabled={alreadyApproved} on:click={handleApprove}>Approve</Button>
	{/if}
{:else if alreadyConnected}
	<p>Waiting for coordinator</p>
{:else}
	<Button disabled={alreadyConnected} on:click={handleConnectToCoordinator}
		>Connect to coordinator</Button
	>
{/if}
