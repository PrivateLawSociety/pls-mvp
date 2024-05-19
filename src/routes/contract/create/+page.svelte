<script lang="ts">
	import { Button } from 'flowbite-svelte';
</script>

<div class="h-full flex flex-col justify-between items-center">
	<div class="flex flex-col items-center justify-center h-full gap-2">
		<li>Only one of the involved parties should create the contract here.</li>
		<li>After created, the other involved parties will just sign the contract</li>
	</div>
	<a href="/contract/create/1">
		<Button class="w-48 md:w-52">Next</Button>
	</a>
</div>
