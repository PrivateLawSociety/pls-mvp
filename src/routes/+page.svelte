<script lang="ts">
	import Person from '$lib/components/Person.svelte';
	import { nostrAuth } from '$lib/nostr';
	import { Button, P } from 'flowbite-svelte';
	import { DiscordSolid, GithubSolid, YoutubeSolid, XSolid } from 'flowbite-svelte-icons';
</script>

{#if $nostrAuth?.pubkey}
	<div class="flex flex-col justify-center items-center h-full gap-8">
		<a href="/keys">
			<Person pubkey={$nostrAuth.pubkey} />
		</a>

		<div class="flex flex-col justify-center items-center gap-4">
			<a href="/contract/create" class="w-full md:w-auto">
				<Button class="w-48 md:w-64">Create</Button>
			</a>

			<a href="/contract/join" class="w-full md:w-auto">
				<Button class="w-48 md:w-64">Sign</Button>
			</a>

			<a href="/contract/verify" class="w-full md:w-auto">
				<Button class="w-48 md:w-64">Verify</Button>
			</a>

			<!-- <a href="/settings" class="w-full md:w-auto">
				<Button class="w-48 md:w-64">Settings</Button>
			</a> -->
		</div>
	</div>
{:else}
	<div class="flex flex-col justify-center h-full gap-4 p-4">
		<div class="flex justify-center">
			<P size="4xl" align="center" weight="normal">Secure your contracts with bitcoin</P>
		</div>

		<div class="w-full flex flex-col justify-center items-center h-full gap-4">
			<a href="/start">
				<Button class="w-48 md:w-64">Start</Button>
			</a>
		</div>
	</div>
{/if}

<hr class="border-t border-white" />

<footer class="p-4 text-white">
	<div class="flex justify-center space-x-4">
		<a href="https://www.privatelawsociety.net/join" target="_blank" rel="noopener noreferrer">
			<DiscordSolid class="hover:text-primary-600 active:text-primary-800" size="xl" />
		</a>
		<a href="https://x.com/PrivateLawSoc" target="_blank" rel="noopener noreferrer">
			<XSolid class="hover:text-primary-600 active:text-primary-800" size="xl" />
		</a>
		<a href="https://www.youtube.com/@privatelawsociety" target="_blank" rel="noopener noreferrer">
			<YoutubeSolid class="hover:text-primary-600 active:text-primary-800" size="xl" />
		</a>
		<a href="https://github.com/PrivateLawSociety/" target="_blank" rel="noopener noreferrer">
			<GithubSolid class="hover:text-primary-600 active:text-primary-800" size="xl" />
		</a>
	</div>
</footer>
