<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { resolve } from '$app/paths';

	let visible = false;
	let tagline = '"You want it, we got it"';
	onMount(() => {
		visible = true;
	});
</script>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#0a0a0a] via-[#161621] to-[#0a0a0a] p-4 font-sans text-white"
>
	<div
		class="absolute inset-0 -z-10 animate-pulse bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_70%)]"
	></div>

	{#if visible}
		<h1
			class="bg-linear-to-r from-white to-gray-400 bg-clip-text text-5xl font-extrabold tracking-wide text-transparent drop-shadow-[0_0_25px_rgba(255,255,255,0.1)] sm:text-6xl md:text-7xl"
			in:fly={{ y: -40, delay: 200, duration: 500 }}
		>
			Obsonarium
		</h1>

		<p
			class="mt-3 text-lg font-light text-gray-300 italic sm:text-xl md:text-2xl"
			in:fly={{ y: -40, delay: 200, duration: 500 }}
		>
			{tagline}
		</p>
		<div in:fly={{ y: 40, delay: 200, duration: 500 }} class="mt-10 flex-row space-x-1.5">
			<a
				class="mt-10 rounded-full bg-white px-8 py-3 text-lg font-medium text-gray-900 transition-all duration-300 hover:scale-105 hover:bg-gray-200"
				href={resolve('/shop')}
			>
				Shop
			</a>
		</div>
	{/if}
</div>
