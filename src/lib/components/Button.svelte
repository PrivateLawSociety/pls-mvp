<script>
	export let disabled = false;

	const normalStyles = 'bg-yellow-400 hover:bg-yellow-300';
	const disabledStyles = 'bg-slate-300 hover:bg-slate-300';

	$: styles = disabled ? disabledStyles : normalStyles;
</script>

<button on:click class="px-3 py-1 rounded-lg text-black {styles} font-bold transition-colors">
	<slot />
</button>
