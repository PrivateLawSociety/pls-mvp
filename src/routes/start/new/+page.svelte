<script lang="ts">
	import { nostrAuth } from '$lib/nostr';
	import { Button, Checkbox, Input, Label, P, Toast } from 'flowbite-svelte';
	import { slide } from 'svelte/transition';
	import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

	let agreed1 = false;
	let agreed2 = false;
	let agreed3 = false;
	let fullyAgreed = false;

	let hasStoredKeys = false;

	let privateKey = generateSecretKey();
	let privateKeyStr = Buffer.from(privateKey).toString('hex');

	$: nsec = nip19.nsecEncode(privateKey);
	$: publicId = getPublicKey(privateKey);
	$: npub = nip19.npubEncode(publicId);

	let copiedPubkey = false;
	let copiedSeckey = false;
</script>

{#if fullyAgreed}
	<div class="w-full flex flex-col justify-center items-center h-full gap-4 p-4">
		<div class="flex justify-center">
			<P align="center" size="4xl" weight="normal">Generated PLS Identity</P>
		</div>

		<div class="flex justify-center w-full flex-col items-center h-full gap-4">
			<div>
				<Label class="mb-2">Public ID</Label>
				<Input
					type="text"
					readonly
					value={npub}
					on:click={async () => {
						await navigator.clipboard.writeText(npub ?? '');

						copiedPubkey = true;
						setTimeout(() => (copiedPubkey = false), 3000);
					}}
				/>
			</div>

			<Toast dismissable={false} bind:open={copiedPubkey} transition={slide}
				>Copied public ID to clipboard.</Toast
			>

			<div>
				<Label class="mb-2">Secret key</Label>
				<Input
					class="cursor-pointer"
					type="text"
					readonly
					on:click={async () => {
						await navigator.clipboard.writeText(nsec);

						copiedSeckey = true;
						setTimeout(() => (copiedSeckey = false), 3000);
					}}
					value={nsec}
				/>
			</div>

			<Toast dismissable={false} bind:open={copiedSeckey} transition={slide}
				>Copied secret key to clipboard.</Toast
			>
		</div>
		<Checkbox bind:checked={hasStoredKeys} spacing="me-4"
			>I've stored my secret key in a safe and private place</Checkbox
		>
		<a href="/">
			<Button disabled={!hasStoredKeys} on:click={() => nostrAuth.loginWithPrivkey(privateKeyStr)}
				>Continue</Button
			>
		</a>
	</div>
{:else}
	<div class="w-full flex flex-col justify-center items-center h-full gap-4 p-4">
		<div class="flex justify-center">
			<P size="4xl" weight="normal">Understanding</P>
		</div>

		<div class="flex justify-center w-full flex-col items-center h-full gap-4">
			<p>By using PLS you understand and agree with the following:</p>
			<Checkbox bind:checked={agreed1} class="lg:w-1/3"
				>With bitcoin, you are your own bank. No one can recover your secret key if you lose it.</Checkbox
			>
			<Checkbox bind:checked={agreed2} class="lg:w-1/3"
				>If you lose your secret key, your PLS identity and your bitcoin cannot be recovered.</Checkbox
			>
			<Checkbox bind:checked={agreed3} class="lg:w-1/3"
				>If someone has access to your secret key, they can impersonate your PLS identity and
				potentially steal your Bitcoin.</Checkbox
			>
		</div>
		<Button disabled={!agreed1 || !agreed2 || !agreed3} on:click={() => (fullyAgreed = true)}
			>Continue</Button
		>
	</div>
{/if}
