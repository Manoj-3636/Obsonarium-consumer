<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/stores";
	import { ArrowLeft, Loader2 } from "@lucide/svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { toast } from "svelte-sonner";
	import { apiFetch } from "$lib/api";

	let loading = $state(true);
	let error = $state<string | null>(null);

	let product = $state<{
		id: number;
		name: string;
		price: number;
		image: string;
		stock_qty: number;
		retailer_id: number;
		description: string;
		cartQty: number | null;
		isQtyLoading: boolean;
	} | null>(null);

	let retailerName = $state<string | null>(null);
	let currentFetch: AbortController | null = null;

	$effect(() => {
		loadProduct($page.params.id);
	});

	async function loadProduct(id: string) {
		if (currentFetch) currentFetch.abort();
		currentFetch = new AbortController();

		loading = true;
		error = null;

		try {
			const res = await fetch(`/api/shop/${id}`, { signal: currentFetch.signal });
			if (!res.ok) throw new Error("Failed to fetch");

			const data = await res.json();

			product = {
				id: data.product.Id,
				name: data.product.Name,
				price: data.product.Price,
				image: data.product.Image_url,
				stock_qty: data.product.Stock_qty,
				retailer_id: data.product.Retailer_id,
				description: data.product.Description,
				cartQty: null,
				isQtyLoading: false
			};

			// Retailer info
			const r = await fetch(`/api/retailers/${product.retailer_id}`, {
				signal: currentFetch.signal
			});
			if (r.ok) {
				retailerName = (await r.json()).retailer.Name;
			}

		} catch (err) {
			if (!(err instanceof Error) || err.name !== "AbortError") {
				error = "Failed to load product details";
			}
		} finally {
			loading = false;
			currentFetch = null;
		}
	}

	/* -------------------------------------------
	   CART LOGIC (identical to /shop list)
	-------------------------------------------- */

	async function addToCart() {
		if (!product) return;

		product.isQtyLoading = true;
		if (product.cartQty === null) product.cartQty = 0;

		product.cartQty++;
		toast.success(`${product.name} added to cart`, { duration: 2000 });

		try {
			const res = await apiFetch("/api/cart/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					product_id: product.id,
					quantity: 1
				})
			});

			if (!res.ok) throw new Error();
			product.cartQty = (await res.json()).quantity;

		} catch (err) {
			product.cartQty = null;
			
			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error("Failed to add to cart");
			}
		}

		product.isQtyLoading = false;
	}

	async function increaseQty() {
		if (!product || product.cartQty === null) return;

		const old = product.cartQty;
		product.cartQty++;
		product.isQtyLoading = true;

		try {
			const res = await apiFetch("/api/cart/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					product_id: product.id,
					quantity: 1
				})
			});

			if (!res.ok) throw new Error();
			product.cartQty = (await res.json()).quantity;

		} catch (err) {
			product.cartQty = old;
			
			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error("Failed to update quantity");
			}
		}

		product.isQtyLoading = false;
	}

	async function decreaseQty() {
		if (!product || product.cartQty === null) return;

		const old = product.cartQty;
		product.cartQty--;
		product.isQtyLoading = true;

		try {
			const res = await apiFetch("/api/cart/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					product_id: product.id,
					quantity: -1
				})
			});

			if (!res.ok) throw new Error();

			const newQty = (await res.json()).quantity;
			product.cartQty = newQty <= 0 ? null : newQty;

		} catch (err) {
			product.cartQty = old;
			
			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error("Failed to update quantity");
			}
		}

		product.isQtyLoading = false;
	}
</script>

<main class="container mx-auto px-4 py-8">
	<Button variant="ghost" href="/shop" class="mb-6">
		<ArrowLeft class="size-4 mr-2" /> Back to Shop
	</Button>

	<!-- Loading -->
	{#if loading}
		<div class="grid gap-8 md:grid-cols-2">
			<div class="aspect-square w-full overflow-hidden rounded-lg bg-muted">
				<Skeleton class="h-full w-full" />
			</div>
			<div class="space-y-6">
				<Skeleton class="h-10 w-3/4" />
				<Skeleton class="h-6 w-1/2" />
				<Skeleton class="h-4 w-full" />
			</div>
		</div>

	<!-- Error -->
	{:else if error}
		<Card.Root class="max-w-md mx-auto">
			<Card.Content class="p-6 text-center">
				<p class="text-lg font-medium text-destructive mb-2">{error}</p>
				<Button href="/shop" variant="outline">Return to Shop</Button>
			</Card.Content>
		</Card.Root>

	<!-- Product -->
	{:else if product}
		<div class="grid gap-8 md:grid-cols-2">

			<div class="aspect-square w-full overflow-hidden rounded-lg bg-muted">
				<img alt={product.name} src={product.image} class="h-full w-full object-cover" />
			</div>

			<div class="space-y-6">
				<h1 class="text-3xl font-bold">{product.name}</h1>
				<p class="text-3xl font-bold">${product.price.toFixed(2)}</p>
				<p class="text-muted-foreground">{product.description}</p>

				<!-- CART CONTROLS -->
				<div class="flex gap-3">
					{#if product.cartQty === null}
						<Button size="lg" class="flex-1"
							disabled={product.stock_qty === 0}
							onclick={addToCart}>
							Add to Cart
						</Button>
					{:else}
						<div class="flex items-center gap-3">
							<Button size="lg" disabled={product.isQtyLoading} onclick={decreaseQty}>-</Button>

							{#if product.isQtyLoading}
								<Loader2 class="size-5 animate-spin" />
							{:else}
								<span class="text-xl font-semibold">{product.cartQty}</span>
							{/if}

							<Button size="lg" disabled={product.isQtyLoading} onclick={increaseQty}>+</Button>
						</div>
					{/if}
				</div>

				<Card.Root>
					<Card.Header><Card.Title>Product Information</Card.Title></Card.Header>
					<Card.Content>
						<p><b>Retailer:</b> {retailerName || product.retailer_id}</p>
						<p><b>Stock:</b> {product.stock_qty}</p>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	{/if}
</main>
