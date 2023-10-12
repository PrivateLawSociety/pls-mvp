<script lang="ts">
	import { ECPair, NETWORK, createMultisig } from '$lib/pls/multisig';
	import Button from '$lib/components/Button.svelte';
	import { broadcastToNostr, makeNostrEvent, nostrNowAdjusted, nostrSubscribe } from '$lib/nostr';
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
	import { signPartialContract, type FinishedContractData } from '$lib/pls/contract';
	import LabelledInput from '$lib/components/LabelledInput.svelte';

	export let myFileHash: string;
	export let wifKey: string;
	export let coordinationStarted: boolean;

	let alreadyStartedMultisig = false;

	let isAlsoParticipating = false;

	let publicKey = '';

	let clientPubkeys: string[] = [];
	let arbitratorPubkeys: string[] = [];
	let collectedSignatures: Record<string, string> = {};

	let arbitratorsQuorum = 1;

	let finishedContract: FinishedContractData | null = null;

	$: multisigPubkeys = [...clientPubkeys, ...arbitratorPubkeys];

	$: {
		try {
			const ecpair = ECPair.fromWIF(wifKey, NETWORK);
			publicKey = ecpair.publicKey.toString('hex');
		} catch (error) {}
	}

	async function handleStartCoordination() {
		const myPrivKey = ECPair.fromWIF(wifKey, NETWORK)?.privateKey?.toString('hex');

		if (!myPrivKey) return;

		const myBitcoinPubkey = ECPair.fromWIF(wifKey, NETWORK).publicKey.toString('hex');

		const myNostrPubkey = BitcoinToNostrPubkey(myBitcoinPubkey);

		if (isAlsoParticipating) {
			arbitratorPubkeys = [...arbitratorPubkeys, myBitcoinPubkey];
		}

		nostrSubscribe([
			{
				kinds: [FirstEvent],
				'#p': [myNostrPubkey],
				since: nostrNowAdjusted()
			}
		]).on('event', async (e) => {
			if (e.kind === FirstEvent) {
				const {
					fileHash: otherFileHash,
					pubkey: otherBitcoinPubkey,
					isArbitrator
				} = JSON.parse(await nip04.decrypt(myPrivKey, e.pubkey, e.content)) as FirstEventPayload;

				if (myFileHash !== otherFileHash)
					return alert(`${otherBitcoinPubkey} tried connecting, but they sent the wrong file`);

				if (multisigPubkeys.includes(otherBitcoinPubkey)) return;

				if (isArbitrator) {
					arbitratorPubkeys = [...arbitratorPubkeys, otherBitcoinPubkey];
				} else {
					clientPubkeys = [...clientPubkeys, otherBitcoinPubkey];
				}
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

		const { multisig } = createMultisig(
			clientPubkeys.map((pubkey) => ECPair.fromPublicKey(Buffer.from(pubkey, 'hex'))),
			arbitratorPubkeys.map((pubkey) => ECPair.fromPublicKey(Buffer.from(pubkey, 'hex'))),
			arbitratorsQuorum,
			NETWORK
		);

		if (isAlsoParticipating) {
			const mySignature = signPartialContract(myKeypair, {
				arbitratorPubkeys,
				arbitratorsQuorum,
				clientPubkeys,
				fileHash: myFileHash
			}).toString('hex');

			collectedSignatures[myPubkey] = mySignature;
		}

		const pubkeysExceptCoordinator = multisigPubkeys.filter((pubkey) => myPubkey != pubkey);

		for (const bitcoinPubkey of pubkeysExceptCoordinator) {
			const otherNostrPubkey = BitcoinToNostrPubkey(bitcoinPubkey);

			const encryptedText = await nip04.encrypt(
				myPrivkey,
				otherNostrPubkey,
				JSON.stringify({
					arbitratorPubkeys: arbitratorPubkeys,
					arbitratorsQuorum,
					clientPubkeys: clientPubkeys
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
				since: nostrNowAdjusted()
			}
		]).on('event', async (e) => {
			const { signature } = JSON.parse(
				await nip04.decrypt(myPrivkey, e.pubkey, e.content)
			) as ThirdEventPayload;

			const bitcoinPubkey = multisigPubkeys.find(
				(pubkey) => BitcoinToNostrPubkey(pubkey) == e.pubkey
			);

			if (!bitcoinPubkey) return;

			if (!multisigPubkeys.includes(bitcoinPubkey)) return;

			collectedSignatures[bitcoinPubkey] = signature;

			if (Object.values(collectedSignatures).length === multisigPubkeys.length) {
				finishedContract = {
					arbitratorPubkeys,
					arbitratorsQuorum,
					clientPubkeys,
					fileHash: myFileHash,
					multisigAddress: multisig.address!,
					signatures: collectedSignatures
				};
			}
		});

		alreadyStartedMultisig = true;
	}

	$: finishedContractBlob = URL.createObjectURL(
		new Blob([JSON.stringify(finishedContract, null, 4)])
	);
</script>

{#if finishedContract}
	<h1 class="text-3xl">Contract data generated</h1>
	<Button>
		<a download="contract_data.json" href={finishedContractBlob}>Download</a>
	</Button>
{:else if coordinationStarted}
	<p>Collected client pubkeys:</p>
	{#each clientPubkeys as pubkey}
		<!-- TODO: also check if signature is valid -->
		{@const signed = collectedSignatures[pubkey] !== undefined}

		{#if alreadyStartedMultisig}
			<p>
				{pubkey}: <span class="text-2xl">{signed ? '✅' : '🕓'}</span>
				<span class="font-bold">{signed ? 'Signed' : 'Waiting'}</span>
			</p>
		{:else}
			<p>
				{pubkey}
			</p>
		{/if}
	{/each}
	<p>Collected arbitrator pubkeys:</p>
	{#each arbitratorPubkeys as pubkey}
		<!-- TODO: also check if signature is valid -->
		{@const signed = collectedSignatures[pubkey] !== undefined}

		{#if alreadyStartedMultisig}
			<p>
				{pubkey}: <span class="text-2xl">{signed ? '✅' : '🕓'}</span>
				<span class="font-bold">{signed ? 'Signed' : 'Waiting'}</span>
			</p>
		{:else}
			<p>
				{pubkey}
			</p>
		{/if}
	{/each}
	<LabelledInput
		type="number"
		label="How many arbitrators need to agree?"
		bind:value={arbitratorsQuorum}
	/>
	{#if !alreadyStartedMultisig}
		<Button on:click={handleStartMultisig}>Request approval</Button>
	{/if}
{:else}
	{#if publicKey}
		<p class="text-center">
			Your public key: <br />
			{publicKey}
		</p>
	{/if}
	<label class="inline-flex items-center gap-2">
		<input class="accent-yellow-400 p-2 w-4 h-4" type="checkbox" bind:value={isAlsoParticipating} />
		Also participate as arbitrator?
	</label>
	<Button on:click={handleStartCoordination}>Start coordination</Button>
{/if}
