<script lang="ts">
	import '../app.postcss';
	import { page } from '$app/stores';
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
</script>

<div class="flex flex-col h-screen">
	<div>
		<Navbar let:hidden let:toggle>
			<NavBrand href="/">
				<img src="/favicon.png" class="mr-3 h-6 sm:h-9" alt="PLS Logo" />
				<span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
					Private Law Society
				</span>
			</NavBrand>
			<NavHamburger on:click={toggle} />
			<NavUl {hidden} activeUrl={$page.url.pathname}>
				{#if $page.url.pathname !== '/'}
					<NavLi><button on:click={() => history.back()}>Back</button></NavLi>
				{/if}
				<NavLi href="/">Home</NavLi>
				<NavLi>
					<a
						href="https://github.com/PrivateLawSociety/pls-mvp/blob/main/README.md"
						target="_blank"
						rel="noopener noreferrer">Guide</a
					>
				</NavLi>
			</NavUl>
		</Navbar>
	</div>

	<slot />
</div>
