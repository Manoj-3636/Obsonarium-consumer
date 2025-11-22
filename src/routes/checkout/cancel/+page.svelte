<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { ShoppingBag, XCircle } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	onMount(() => {
		toast.error('Payment was cancelled');
	});
</script>

<main class="container mx-auto px-4 py-8 max-w-6xl">
	<div
		class="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in zoom-in-95 duration-500"
	>
		<div
			class="size-24 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4"
		>
			<XCircle class="size-12" />
		</div>
		<h1 class="text-3xl font-bold text-center">Payment Cancelled</h1>
		<p class="text-muted-foreground text-center max-w-md">
			Your payment was cancelled. No charges were made. You can try again or continue shopping.
		</p>
		<div class="pt-6 flex gap-4">
			<Button href="/checkout" variant="default" class="h-12 px-8 text-lg">
				Try Again
			</Button>
			<Button href="/shop" variant="outline" class="h-12 px-8 text-lg">
				Continue Shopping
			</Button>
		</div>
	</div>
</main>

