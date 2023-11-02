<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import { broadcastToNostr, nostrAuth, nostrNowBasic, relayList, relayPool } from '$lib/nostr';
	import { hashFromFile, hashFromJSON } from '$lib/utils';
	import { onMount } from 'svelte';
	import PersonChooser from '$lib/components/PersonChooser.svelte';
	import { ContractRequestEvent, type ContractRequestPayload } from './shared';
	import { peopleMetadata } from '$lib/stores';

	let myPubkey: string | null = null;

	let contactPubkeys: string[] = [];

	let clients: (string | null)[] = [null, null];

	let arbitrators: string[] = [];

	let arbitratorsQuorum = 1;

	let myFiles: FileList | undefined;
	let myFileHash: string | undefined;

	$: contactsAndMe = Array.from(
		myPubkey ? new Set([myPubkey, ...contactPubkeys]) : new Set(contactPubkeys)
	);

	$: {
		const file = myFiles?.item(0);

		if (file)
			hashFromFile(file).then((hash) => {
				myFileHash = hash.toString('hex');
			});
	}

	let newlySelectedPubkey: string | null = null;

	async function getContactsInfo(pubkey: string) {
		const value = await relayPool.get(relayList, {
			authors: [pubkey],
			kinds: [3],
			until: nostrNowBasic()
		});

		if (!value) return;

		const contacts = value.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1]);

		contactPubkeys = contacts;

		contacts.forEach(peopleMetadata.fetchPerson);
	}

	onMount(async () => {
		if (await nostrAuth.tryLogin()) {
			const pubkey = $nostrAuth?.pubkey!;

			myPubkey = pubkey;

			peopleMetadata.fetchPerson(pubkey);
			getContactsInfo(pubkey);
		}
	});

	async function requestSignatures() {
		if (!myFileHash) return alert('please select a file')!;

		if (!clients[0] || !clients[1]) return alert('Contracts need exactly 2 clients');

		const pubkeys = [clients[0], clients[1], ...arbitrators];

		const payload = {
			arbitratorPubkeys: arbitrators.map((p) => p),
			arbitratorsQuorum,
			clientPubkeys: [clients[0], clients[1]],
			fileHash: myFileHash
		} satisfies ContractRequestPayload;

		for (const pubkey of pubkeys) {
			const encryptedText = await nostrAuth.encryptDM(pubkey, JSON.stringify(payload));

			const event = await nostrAuth.makeEvent(ContractRequestEvent, encryptedText, [['p', pubkey]]);

			broadcastToNostr(event);
		}
	}
</script>

<div class="flex justify-center">
	<div class="flex flex-col gap-4 w-1/2">
		<div>
			<span>Clients ({clients.length})</span>
			<div class="flex gap-4">
				<PersonChooser people={contactsAndMe} bind:selectedPerson={clients[0]} />
				<PersonChooser people={contactsAndMe} bind:selectedPerson={clients[1]} />
			</div>
		</div>
		<div>
			<span>Arbitrators ({arbitrators.length})</span>
			<div class="flex gap-4">
				{#each arbitrators as _, i}
					<PersonChooser
						people={contactsAndMe}
						on:selection={(e) => {
							if (e.detail === null) {
								arbitrators = arbitrators.filter((_, index) => index !== i);
							}
						}}
						bind:selectedPerson={arbitrators[i]}
					/>
				{/each}
				<PersonChooser
					people={contactsAndMe}
					on:selection={(e) => {
						arbitrators = [...arbitrators, e.detail];
						newlySelectedPubkey = null;
					}}
					bind:selectedPerson={newlySelectedPubkey}
				/>
			</div>
		</div>

		<label>
			Arbitrators quorum:
			<input
				class="border border-gray-300 bg-transparent"
				type="number"
				bind:value={arbitratorsQuorum}
				min={0}
				max={arbitrators.length}
			/>
		</label>
		<p>Contract file: <input type="file" bind:files={myFiles} /></p>
		<Button on:click={requestSignatures}>Request signatures</Button>
	</div>
</div>
