<script lang="ts">
	import { onMount } from "svelte";
	import { Loader2, Trash, ArrowLeft } from "@lucide/svelte";
	import * as Card from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { toast } from "svelte-sonner";

	interface CartItem {
		id: number;
		product_id: number;
		quantity: number;
		name: string;
		price: number;
		image: string;
		stock_qty: number;
		isQtyLoading: boolean;
	}

	let loading = $state(true);
	let items = $state<CartItem[]>([]);
	let errorMessage = $state<string | null>(null);

	async function loadCart() {
		loading = true;
		errorMessage = null;

		try {
			const res = await fetch("/api/cart");
			if (!res.ok) throw new Error("Failed to fetch cart");

			const data = await res.json();
			const raw = Array.isArray(data.cart) ? data.cart : [];

			items = raw.map((row: any): CartItem => {
				const p = row.Product || {};
				return {
					id: row.Id,
					product_id: row.Product_id,
					quantity: row.Quantity,
					name: p.Name ?? "Unknown Product",
					price: Number(p.Price ?? 0),
					image: p.Image_url ?? "/placeholder.png",
					stock_qty: p.Stock_qty ?? 0,
					isQtyLoading: false
				};
			});
		} catch (err) {
			console.error(err);
			errorMessage = "Failed to load cart";
			items = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => loadCart());

	async function modifyQty(product_id: number, delta: number) {
		const item = items.find(i => i.product_id === product_id);
		if (!item) return;

		const oldQty = item.quantity;
		item.quantity += delta;
		item.isQtyLoading = true;

		try {
			const res = await fetch("/api/cart/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ product_id, quantity: delta })
			});

			if (!res.ok) throw new Error("Update failed");

			const data = await res.json();
			item.quantity = data.quantity;

			if (item.quantity <= 0) {
				items = items.filter(i => i.product_id !== product_id);
			}
		} catch (err) {
			console.error(err);
			item.quantity = oldQty;
			toast.error("Failed to update quantity");
		}

		item.isQtyLoading = false;
	}

	async function deleteItem(product_id: number) {
		const item = items.find(i => i.product_id === product_id);
		if (!item) return;

		item.isQtyLoading = true;

		try {
			const res = await fetch(`/api/cart/${product_id}`, {
				method: "DELETE"
			});

			if (!res.ok) throw new Error("Remove failed");

			items = items.filter(i => i.product_id !== product_id);
			toast.success("Item removed");
		} catch (err) {
			console.error(err);
			item.isQtyLoading = false;
			toast.error("Failed to remove item");
		}
	}

	$effect(() => {
		total = items.reduce((s, it) => s + it.price * it.quantity, 0);
	});
	let total = $state(0);
</script>

<main class="container mx-auto px-4 py-8">

	<!-- Page Title + Back Button -->
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-3xl font-bold tracking-tight">Your Cart</h1>

		<Button variant="ghost" href="/shop" class="gap-2">
			<ArrowLeft class="size-4" />
			Back to Shop
		</Button>
	</div>

	<!-- LOADING -->
	{#if loading}
		<div class="space-y-4">
			{#each Array(4) as _}
				<Card.Root>
					<Card.Content class="p-4 flex gap-4 items-center">
						<Skeleton class="h-20 w-20 rounded-md" />
						<div class="flex-1 space-y-2">
							<Skeleton class="h-6 w-2/3" />
							<Skeleton class="h-4 w-1/3" />
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

	<!-- ERROR -->
	{:else if errorMessage}
		<p class="text-destructive">{errorMessage}</p>

	<!-- EMPTY CART -->
	{:else if items.length === 0}
		<div class="text-center py-20">
			<h2 class="text-lg font-medium text-muted-foreground">Your cart is empty</h2>
			<Button href="/shop" class="mt-4">Back to Shop</Button>
		</div>

	<!-- CART ITEMS -->
	{:else}
		<div class="space-y-4">
			{#each items as item (item.product_id)}
				<Card.Root>
					<Card.Content class="p-4 flex items-center gap-4">
						<img src={item.image} alt={item.name} class="h-24 w-24 object-cover rounded-md" />

						<div class="flex-1">
							<h2 class="font-semibold text-lg">{item.name}</h2>
							<p class="text-muted-foreground">${item.price.toFixed(2)}</p>
						</div>

						<div class="flex items-center gap-2">
							<Button
								size="sm" variant="outline"
								disabled={item.isQtyLoading}
								onclick={() => modifyQty(item.product_id, -1)}
							>-</Button>

							{#if item.isQtyLoading}
								<Loader2 class="size-4 animate-spin" />
							{:else}
								<span class="font-medium">{item.quantity}</span>
							{/if}

							<Button
								size="sm" variant="outline"
								disabled={item.isQtyLoading}
								onclick={() => modifyQty(item.product_id, +1)}
							>+</Button>
						</div>

						<Button
							size="icon"
							variant="ghost"
							disabled={item.isQtyLoading}
							onclick={() => deleteItem(item.product_id)}
						>
							<Trash class="size-5 text-destructive" />
						</Button>
					</Card.Content>
				</Card.Root>
			{/each}

			<Card.Root class="mt-6">
				<Card.Content class="p-6 flex justify-between text-lg font-semibold">
					<span>Total</span>
					<span>${total.toFixed(2)}</span>
				</Card.Content>
			</Card.Root>

			<Button size="lg" class="w-full mt-4">Proceed to Checkout</Button>
		</div>
	{/if}

</main>
