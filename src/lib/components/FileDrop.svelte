<script lang="ts">
	let isDragging = false;

	export let files: FileList | null;

	export let dropText = 'Drop files here';

	let dropArea: HTMLLabelElement;

	$: file = files?.item(0) ?? null;

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		files = event.dataTransfer?.files!;
	}
</script>

<label
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop={handleDrop}
	bind:this={dropArea}
	class={`border-2 border-dashed px-8 py-4 rounded-lg text-center transition-colors cursor-pointer hover:bg-slate-700 ${
		isDragging ? 'border-yellow-400' : 'border-gray-300'
	}`}
>
	<input bind:files type="file" class="hidden" />
	<p class="text-lg">{file ? file.name : dropText}</p>
</label>
