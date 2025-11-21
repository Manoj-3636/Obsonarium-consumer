<script lang="ts">
	import { XCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<main class="container mx-auto px-4 py-20 flex flex-col items-center text-center space-y-6">
	<XCircle class="h-24 w-24 text-destructive" />
	<h1 class="text-4xl font-bold tracking-tight">Checkout Cancelled</h1>
	<p class="text-muted-foreground text-lg max-w-md">
		Your order was not placed. No charges were made.
	</p>
	<div class="flex gap-4">
		<Button href="/cart" size="lg">Return to Cart</Button>
		<Button href="/shop" variant="outline" size="lg">Continue Shopping</Button>
	</div>
</main>
