<script lang="ts">
	type Type = $$Generic<'text' | 'number'>;
	export let type: Type;

	export let label: string;
	export let value: Type extends 'text' ? string : number;

	const styles = 'border-4 p-1 rounded-lg text-black';
</script>

<label class="flex flex-col gap-1">
	{label}
	{#if type == 'text'}
		<input class={styles} type="text" bind:value />
	{:else if type == 'number'}
		<input class={styles} type="number" bind:value />
	{/if}
</label>
