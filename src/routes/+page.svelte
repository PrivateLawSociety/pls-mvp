<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import DropContract from '$lib/components/DropContract.svelte';
</script>

<div class="flex text-2xl flex-col items-center justify-center h-screen w-full gap-4">
	<h1 class="text-5xl pb-10">Secure Your Agreements with Bitcoin</h1>
	<Button>
		<a href="/contract/create">Create a new contract</a>
	</Button>
	<p>Or</p>
	<Button>
		<a href="/contract/join">Join a contract</a>
	</Button>
	<p>Or</p>
	<p>if you already have a contract, view its options here:</p>
	<DropContract onSelected={() => goto('/contract/verify')} />
</div>
