<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { ShoppingBag, CheckCircle2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let orderId = $state<string | null>(null);

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		orderId = urlParams.get('order_id');
		
		if (orderId) {
			toast.success('Payment successful! Your order has been placed.');
		}
	});
</script>

<main class="container mx-auto px-4 py-8 max-w-6xl">
	<div
		class="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in zoom-in-95 duration-500"
	>
		<div
			class="size-24 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4"
		>
			<CheckCircle2 class="size-12" />
		</div>
		<h1 class="text-3xl font-bold text-center">Payment Successful!</h1>
		<p class="text-muted-foreground text-center max-w-md">
			Thank you for your purchase. Your order has been received and will be processed shortly.
			{#if orderId}
				<br />
				<span class="font-medium">Order ID: #{orderId}</span>
			{/if}
		</p>
		<div class="pt-6">
			<Button href="/shop" class="h-12 px-8 text-lg">Continue Shopping</Button>
		</div>
	</div>
</main>

