<script lang="ts">
	import { onMount } from "svelte";
	import { Search, ShoppingCart, Loader2 } from "@lucide/svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import { toast } from "svelte-sonner";
	import { resolve } from '$app/paths';
	import { apiFetch } from "$lib/api";

	/** ---- PRODUCT TYPE ---- **/
	interface Product {
		id: number;
		name: string;
		price: number;
		image: string;
		stock_qty: number;

		cartQty: number | null;   // null → not added yet
		isQtyLoading: boolean;    // spinner while waiting
	}

	let searchQuery = $state<string>("");
	let loading = $state<boolean>(true);
	let errorMessage = $state<string | null>(null);

	let products = $state<Product[]>([]);

	/** ---- LOAD PRODUCTS ---- **/
	async function loadProducts(query: string) {
		loading = true;
		errorMessage = null;

		try {
			const trimmed = query.trim();
			const url = trimmed
				? `/api/shop?q=${encodeURIComponent(trimmed)}`
				: `/api/shop`;

			const response = await fetch(url);
			if (!response.ok) throw new Error("API failure");

			const data = await response.json();

			products = data.products.map((product: any): Product => ({
				id: product.Id,
				name: product.Name,
				price: product.Price,
				image: product.Image_url,
				stock_qty: product.Stock_qty,

				cartQty: null,
				isQtyLoading: false
			}));

		} catch (err) {
			console.error(err);
			errorMessage = "Failed to fetch products.";
			products = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => loadProducts(""));

	/** ---- SEARCH ---- **/
	function performSearch() {
		if (searchQuery.trim() === "") return;
		loadProducts(searchQuery);
	}

	/** ------------------------------------------------------------------
	    ADD TO CART (unified logic with + button)
	   ------------------------------------------------------------------ **/
	async function addToCart(productId: number) {
		const p = products.find(p => p.id === productId);
		if (!p) return;

		// Start spinner immediately
		p.isQtyLoading = true;

		// Show quantity controls immediately
		if (p.cartQty === null) p.cartQty = 0;

		// Optimistic: pretend we're adding one
		const optimistic = p.cartQty + 1;
		p.cartQty = optimistic;

		// Success toast stays as requested
		toast.success(`${p.name} added to cart`, { duration: 2000 });

		try {
			const res = await apiFetch("/api/cart/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					product_id: productId,
					quantity: 1
				})
			});

			if (!res.ok) throw new Error("Add to cart failed");

			const data = await res.json();

			p.cartQty = data.quantity;  // backend truth
			p.isQtyLoading = false;

		} catch (err) {
			console.error(err);

			// Rollback
			p.cartQty = null;
			p.isQtyLoading = false;

			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error("Failed to add to cart");
			}
		}
	}

	/** ---- INCREASE QUANTITY ---- **/
	async function increaseQty(productId: number) {
		const p = products.find(p => p.id === productId);
		if (!p || p.cartQty === null) return;

		const oldQty = p.cartQty;

		// Optimistic
		p.cartQty++;
		p.isQtyLoading = true;

		try {
			const res = await apiFetch("/api/cart/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					product_id: productId,
					quantity: 1
				})
			});

			if (!res.ok) throw new Error("Failed to update quantity");

			const data = await res.json();
			p.cartQty = data.quantity;
			p.isQtyLoading = false;

		} catch (err) {
			console.error(err);
			p.cartQty = oldQty;
			p.isQtyLoading = false;
			
			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error("Failed to update quantity");
			}
		}
	}

	/** ---- DECREASE QUANTITY ---- **/
	async function decreaseQty(productId: number) {
		const p = products.find(p => p.id === productId);
		if (!p || p.cartQty === null) return;

		const oldQty = p.cartQty;

		// optimistic
		p.cartQty--;
		p.isQtyLoading = true;

		try {
			const res = await apiFetch("/api/cart/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					product_id: productId,
					quantity: -1
				})
			});

			if (!res.ok) throw new Error("Failed to update quantity");

			const data = await res.json();

			p.cartQty = data.quantity;

			if (p.cartQty <= 0) {
				p.cartQty = null;
			}

			p.isQtyLoading = false;

		} catch (err) {
			console.error(err);
			p.cartQty = oldQty;
			p.isQtyLoading = false;
			
			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error("Failed to update quantity");
			}
		}
	}
</script>

<div class="min-h-screen bg-background">
	<header class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
		<div class="container mx-auto grid h-16 grid-cols-3 items-center gap-4 px-4">

			<!-- Brand -->
			<div class="flex items-center">
				<button class="bg-linear-to-r from-white to-gray-400 bg-clip-text text-2xl font-extrabold tracking-wide text-transparent"
								onclick={() => loadProducts("")}
				>
					Obsonarium
				</button>
			</div>

			<!-- Search -->
			<div class="flex items-center mx-auto w-full max-w-xl gap-2 relative">
				<div class="relative flex-1">
					<Search class="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />

					<Input
						type="search"
						placeholder="Search products..."
						bind:value={searchQuery}
						class="w-full h-11 pl-11 pr-10 text-base"
						onkeydown={(e) => {
							if (e.key === "Enter" && searchQuery.trim() !== "") {
								e.preventDefault();
								performSearch();
							}
						}}
					/>
				</div>

				<Button
					class="h-11 px-4"
					onclick={performSearch}
					disabled={searchQuery.trim() === ""}
				>
					<Search class="size-4 mr-2" /> Search
				</Button>
			</div>

			<!-- Cart -->
			<div class="flex justify-end">
                <Button variant="ghost" size="icon" href={resolve("/cart")}>
                    <ShoppingCart class="size-5" />
                </Button>
            </div>
		</div>
	</header>

	<!-- Main -->
	<main class="container mx-auto px-4 py-8">
		<div class="mb-8">
			<h1 class="text-3xl font-bold tracking-tight">Shop</h1>
			<p class="text-muted-foreground mt-2">Recently added products</p>
		</div>

		<!-- Loading -->
		{#if loading}
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each Array(8) as _}
					<Card.Root class="overflow-hidden">
						<div class="relative aspect-square w-full bg-muted">
							<Skeleton class="h-full w-full" />
						</div>
						<Card.Content class="p-4">
							<Card.Header class="p-0 pb-2">
								<Skeleton class="h-6 w-3/4 mb-2" />
								<Skeleton class="h-4 w-full" />
							</Card.Header>
							<Card.Footer class="flex items-center justify-between p-0 pt-4">
								<Skeleton class="h-6 w-20" />
								<Skeleton class="h-9 w-24" />
							</Card.Footer>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>

		{:else}
			<!-- Product Grid -->
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each products as product (product.id)}
					<Card.Root class="group overflow-hidden transition-shadow hover:shadow-lg">

						<a href="/shop/{product.id}" class="block relative aspect-square w-full overflow-hidden bg-muted">
							<img src={product.image} alt={product.name}
									 class="h-full w-full object-cover transition-transform group-hover:scale-105"
							/>
						</a>

						<Card.Content class="p-4">

							<Card.Header class="p-0 pb-2">
								<a href="/shop/{product.id}" class="hover:text-primary transition-colors">
									<Card.Title class="text-lg font-semibold line-clamp-1">
										{product.name}
									</Card.Title>
								</a>

								{#if product.stock_qty > 0}
									<Card.Description class="text-sm text-muted-foreground">
										{product.stock_qty} in stock
									</Card.Description>
								{:else}
									<Card.Description class="text-sm text-destructive">
										Out of stock
									</Card.Description>
								{/if}
							</Card.Header>

							<Card.Footer class="flex items-center justify-between p-0 pt-4">
								<span class="text-xl font-bold">${product.price.toFixed(2)}</span>

								<!-- CART UI -->
								{#if product.cartQty === null}
									<!-- Add to Cart Button -->
									<Button
										size="sm"
										disabled={product.stock_qty === 0}
										onclick={() => addToCart(product.id)}
									>
										Add to Cart
									</Button>

								{:else}
									<!-- Quantity Controls -->
									<div class="flex items-center gap-2">

										<Button
											size="sm"
											disabled={product.isQtyLoading}
											onclick={() => decreaseQty(product.id)}
										>
											-
										</Button>

										{#if product.isQtyLoading}
											<Loader2 class="size-4 animate-spin" />
										{:else}
											<span class="font-semibold">{product.cartQty}</span>
										{/if}

										<Button
											size="sm"
											disabled={product.isQtyLoading}
											onclick={() => increaseQty(product.id)}
										>
											+
										</Button>

									</div>
								{/if}

							</Card.Footer>
						</Card.Content>

					</Card.Root>
				{/each}
			</div>

			{#if products.length === 0}
				<div class="pt-12 text-center text-muted-foreground">
					<p class="text-lg font-medium">No products found</p>
					<p class="mt-2 text-sm">Try refining your search</p>
				</div>
			{/if}

		{/if}
	</main>
</div>
