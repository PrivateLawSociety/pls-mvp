<script lang="ts">
	import LabelledInput from '$lib/components/LabelledInput.svelte';
	import Button from '$lib/components/Button.svelte';
	import { ECPair, NETWORK, createMultisig } from '$lib/bitcoinjs';
	import { broadcastToNostr, makeNostrEvent, nostrNow, nostrSubscribe } from '$lib/nostr';
	import { nip04 } from 'nostr-tools';
	import { signPartialContract, type PartialContract } from '$lib/pls/contract';
	import { hashFromFile } from '$lib/utils';

	// coordinator <-- clients
	interface FirstEventPayload {
		pubkey: string;
		fileHash: string;
	}

	// coordinator --> clients
	interface SecondEventPayload {
		pubkeys: string[];
	}

	// coordinator <-- clients
	interface ThirdEventPayload {
		signature: string;
	}

	// these events are non-standard, I made them up for the purposes of PLS
	const FirstEvent = 26969;
	const SecondEvent = 26970;
	const ThirdEvent = 26971;

	let userType: 'coordinator' | 'client' | null = null;

	let myFiles: FileList | undefined;
	let myFileHash: string;

	let wifKey = '';
	let publicKey = '';

	let coordinatorBitcoinPubkey = '';

	let collectedBitcoinPubkeys: string[] = [];

	let dataToSign: PartialContract | null = null;

	let collectedSignatures: Record<string, string> = {};

	let alreadyConnected = false;
	let coordinationStarted = false;
	let alreadyApproved = false;
	let alreadyStartedMultisig = false;

	$: {
		const file = myFiles?.item(0);

		if (file)
			hashFromFile(file).then((hash) => {
				myFileHash = hash.toString('hex');
			});
	}

	function BitcoinToNostrPubkey(bitcoinPubkey: string) {
		// Bitcoin pubkeys have a prefix, nostr pubkeys don't
		return bitcoinPubkey.slice(-64);
	}

	function handleGenerateKeypair() {
		const ecpair = ECPair.makeRandom({
			network: NETWORK
		});

		wifKey = ecpair.toWIF();
		publicKey = ecpair.publicKey.toString('hex');
	}

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

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	{#if userType === null}
		<h1 class="text-3xl">Which kind of user are you?</h1>
		<Button on:click={() => (userType = 'client')}>Client</Button>
		<Button on:click={() => (userType = 'coordinator')}>Coordinator</Button>
	{:else}
		<label class="flex items-center justify-center gap-2">
			Contract file:
			<input type="file" bind:files={myFiles} />
		</label>
		<Button on:click={handleGenerateKeypair}>Generate private key</Button>
		<LabelledInput type="text" label="Your WIF key (private key)" bind:value={wifKey} />

		{#if userType === 'coordinator'}
			<LabelledInput type="text" label="Your public key" bind:value={publicKey} />
			{#if !coordinationStarted}
				<Button on:click={handleStartCoordination}>Start coordination</Button>
			{/if}
		{/if}

		{#if userType === 'client'}
			<LabelledInput
				type="text"
				label="Coordinator public key"
				bind:value={coordinatorBitcoinPubkey}
			/>

			{#if dataToSign}
				<p>Involved parties:</p>
				{#each dataToSign.pubkeys as pubkey}
					<p>{pubkey}</p>
				{/each}

				<Button disabled={alreadyApproved} on:click={handleApprove}>Approve</Button>
			{:else}
				<Button disabled={alreadyConnected} on:click={handleConnectToCoordinator}
					>Connect to coordinator</Button
				>
			{/if}
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
	{/if}
</div>
