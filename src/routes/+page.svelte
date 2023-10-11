<script>
	import Button from '$lib/components/Button.svelte';
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-4">
	<Button>
		<a href="/keys">Key generation</a>
	</Button>
	<Button>
		<a href="/contract/create">Create contract</a>
	</Button>
	<Button>
		<a href="/contract/verify">Verify contract</a>
	</Button>
	<Button>
		<a href="/multisig/start">Start spend</a>
	</Button>
	<Button>
		<a href="/multisig/continue">Continue spend</a>
	</Button>
</div>
