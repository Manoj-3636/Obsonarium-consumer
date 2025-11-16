<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/stores";
	import { Search, ShoppingCart, ArrowLeft } from "@lucide/svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";

	let loading = $state(true);
	let product = $state<{
		id: number;
		name: string;
		price: number;
		image: string;
		stock_qty: number;
		retailer_id: number;
		description: string;
	} | null>(null);
	let retailerName = $state<string | null>(null);
	let error = $state<string | null>(null);

	$effect(() => {
		const productId = $page.params.id;
		if (productId) {
			loadProduct(productId);
		}
	});

	let currentFetch: AbortController | null = null;

	async function loadProduct(id: string) {
		// Cancel previous fetch if still in progress
		if (currentFetch) {
			currentFetch.abort();
		}

		currentFetch = new AbortController();
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/shop/${id}`, {
				signal: currentFetch.signal
			});
			if (!response.ok) {
				throw new Error("Failed to fetch product");
			}
			const data = await response.json();
			// Map API response to component structure
			product = {
				id: data.product.Id,
				name: data.product.Name,
				price: data.product.Price,
				image: data.product.Image_url,
				stock_qty: data.product.Stock_qty,
				retailer_id: data.product.Retailer_id,
				description: data.product.Description
			};

			// Fetch retailer information
			if (product.retailer_id) {
				try {
					const retailerResponse = await fetch(`/api/retailers/${product.retailer_id}`, {
						signal: currentFetch.signal
					});
					if (retailerResponse.ok) {
						const retailerData = await retailerResponse.json();
						retailerName = retailerData.retailer.Name;
					}
				} catch (retailerErr) {
					// Silently fail retailer fetch, just don't show name
					console.warn("Failed to fetch retailer:", retailerErr);
				}
			}
		} catch (err) {
			if (err instanceof Error && err.name !== "AbortError") {
				console.error("Error fetching product:", err);
				error = "Failed to load product details";
			}
		} finally {
			loading = false;
			currentFetch = null;
		}
	}
</script>

<div class="min-h-screen bg-background">
	<!-- Header with Search and Cart -->
	<header class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
		<div class="container mx-auto grid h-16 grid-cols-3 items-center gap-4 px-4">
			<!-- Brand Name -->
			<div class="flex items-center">
				<h1 class="bg-linear-to-r from-white to-gray-400 bg-clip-text text-2xl font-extrabold tracking-wide text-transparent drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
					Obsonarium
				</h1>
			</div>

			<!-- Search Bar - Centered -->
			<div class="relative mx-auto w-full max-w-xl">
				<Search class="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					placeholder="Search products..."
					class="w-full h-11 pl-11 text-base"
				/>
			</div>

			<!-- Cart Icon - Right -->
			<div class="flex justify-end">
				<Button variant="ghost" size="icon" class="relative">
					<ShoppingCart class="size-5" />
					<span class="sr-only">Shopping cart</span>
					<!-- Cart badge - will show count later -->
					<span class="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
						0
					</span>
				</Button>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="container mx-auto px-4 py-8">
		<!-- Back Button -->
		<Button variant="ghost" href="/shop" class="mb-6">
			<ArrowLeft class="size-4 mr-2" />
			Back to Shop
		</Button>

		{#if loading}
			<!-- Loading Skeleton -->
			<div class="grid gap-8 md:grid-cols-2">
				<!-- Image Skeleton -->
				<div class="aspect-square w-full overflow-hidden rounded-lg bg-muted">
					<Skeleton class="h-full w-full" />
				</div>

				<!-- Details Skeleton -->
				<div class="space-y-6">
					<div>
						<Skeleton class="h-10 w-3/4 mb-4" />
						<Skeleton class="h-6 w-1/2 mb-4" />
						<Skeleton class="h-4 w-full mb-2" />
						<Skeleton class="h-4 w-full mb-2" />
						<Skeleton class="h-4 w-4/5" />
					</div>
					<div class="space-y-4">
						<Skeleton class="h-12 w-full" />
						<Skeleton class="h-12 w-full" />
					</div>
				</div>
			</div>
		{:else if error}
			<!-- Error State -->
			<Card.Root class="max-w-md mx-auto">
				<Card.Content class="p-6 text-center">
					<p class="text-lg font-medium text-destructive mb-2">{error}</p>
					<Button href="/shop" variant="outline">Return to Shop</Button>
				</Card.Content>
			</Card.Root>
		{:else if product}
			<!-- Product Details -->
			<div class="grid gap-8 md:grid-cols-2">
				<!-- Product Image -->
				<div class="aspect-square w-full overflow-hidden rounded-lg bg-muted">
					<img
						src={product.image}
						alt={product.name}
						class="h-full w-full object-cover"
					/>
				</div>

				<!-- Product Details -->
				<div class="space-y-6">
					<div>
						<h1 class="text-3xl font-bold tracking-tight mb-2">{product.name}</h1>
						<div class="mb-4">
							<span class="text-3xl font-bold">${product.price.toFixed(2)}</span>
$						</div>
						{#if product.description}
							<p class="text-muted-foreground leading-relaxed">{product.description}</p>
						{/if}
					</div>

					<!-- Action Buttons -->
					<div class="flex flex-col gap-3 sm:flex-row">
						<Button
							size="lg"
							class="flex-1"
							disabled={product.stock_qty === 0}
						>
							Add to Cart
						</Button>
						<Button
							size="lg"
							variant="default"
							class="flex-1"
							disabled={product.stock_qty === 0}
						>
							Buy Now
						</Button>
					</div>

					<!-- Additional Info -->
					<Card.Root>
						<Card.Header>
							<Card.Title>Product Information</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-2">
							<div class="flex justify-between">
								<span class="text-muted-foreground">Retailer</span>
								<span class="font-medium">{retailerName || product.retailer_id}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Stock</span>
								<span class="font-medium">{product.stock_qty}</span>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		{/if}
	</main>
</div>

