<script>
	import Button from '$lib/components/Button.svelte';
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<Button>
		<a href="/contract/create">Create contract</a>
	</Button>
	<Button>
		<a href="/multisig/start">Start multisig spend</a>
	</Button>
	<Button>
		<a href="/multisig/finish">Finish multisig spend</a>
	</Button>
</div>
