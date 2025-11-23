<script lang="ts">
	import { onMount } from 'svelte';
	import { Search, ShoppingCart, Loader2, History } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { toast } from 'svelte-sonner';
	import { resolve } from '$app/paths';
	import { apiFetch } from '$lib/api';
	import { MapPin, Navigation } from '@lucide/svelte';

	/** ---- PRODUCT TYPE ---- **/
	interface Product {
		id: number;
		name: string;
		price: number;
		image: string;
		stock_qty: number;
		retailer_id?: number;
		cartQty: number | null; // null → not added yet
		isQtyLoading: boolean; // spinner while waiting
	}

	interface ShopWithDistance {
		retailer: {
			id: number;
			name: string;
			business_name: string;
			address: string;
			latitude?: number | null;
			longitude?: number | null;
		};
		distance: number; // in km
		eta: number; // in minutes
	}

	let searchQuery = $state<string>('');
	let loading = $state<boolean>(true);
	let errorMessage = $state<string | null>(null);

	let products = $state<Product[]>([]);
	let allProducts = $state<Product[]>([]); // Store all products for filtering

	// Filter and sort state
	let minPrice = $state<number | null>(null);
	let maxPrice = $state<number | null>(null);
	let sortBy = $state<string>('default'); // "default", "price_asc", "price_desc"

	// Location state
	let userLat = $state<number | null>(null);
	let userLon = $state<number | null>(null);
	let locationPermission = $state<'prompt' | 'granted' | 'denied'>('prompt');
	let nearbyShops = $state<ShopWithDistance[]>([]);
	let showNearMe = $state<boolean>(false);
	let distanceFilter = $state<number | null>(null); // 1, 3, 5, 10 km
	let locationLoading = $state<boolean>(false);
	let shopsLoading = $state<boolean>(false);

	/** ---- LOAD PRODUCTS ---- **/
	async function loadProducts(query: string) {
		loading = true;
		errorMessage = null;

		try {
			const trimmed = query.trim();
			const url = trimmed ? `/api/shop?q=${encodeURIComponent(trimmed)}` : `/api/shop`;

			const response = await fetch(url);
			if (!response.ok) throw new Error('API failure');

			const data = await response.json();

			allProducts = data.products.map(
				(product: any): Product => ({
					id: product.id,
					name: product.name,
					price: product.price,
					image: product.image_url,
					stock_qty: product.stock_qty,
					retailer_id: product.retailer_id,

					cartQty: null,
					isQtyLoading: false
				})
			);

			applyFiltersAndSort();
		} catch (err) {
			console.error(err);
			errorMessage = 'Failed to fetch products.';
			products = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadProducts('');
		requestLocation();
	});

	/** ---- LOCATION FUNCTIONS ---- **/
	async function requestLocation() {
		if (!navigator.geolocation) {
			toast.error('Geolocation is not supported by your browser');
			return;
		}

		locationLoading = true;
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				userLat = position.coords.latitude;
				userLon = position.coords.longitude;
				locationPermission = 'granted';
				locationLoading = false;

				// Load nearby shops if Near Me is active or just to have data ready
				if (showNearMe) {
					await loadNearbyShops(userLat, userLon);
				}
			},
			(error) => {
				console.error('Geolocation error:', error);
				locationPermission = 'denied';
				locationLoading = false;
				if (error.code === error.PERMISSION_DENIED) {
					toast.error('Location permission denied');
				}
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}

	async function loadNearbyShops(lat: number, lon: number) {
		shopsLoading = true;
		try {
			const radius = distanceFilter || 10; // Default 10km
			const response = await fetch(`/api/shops/nearby?lat=${lat}&lon=${lon}&radius=${radius}`);
			if (!response.ok) throw new Error('Failed to fetch nearby shops');

			const data = await response.json();
			nearbyShops = data.shops || [];
			applyFiltersAndSort();
		} catch (err) {
			console.error('Failed to load nearby shops:', err);
			nearbyShops = [];
			applyFiltersAndSort();
		} finally {
			shopsLoading = false;
		}
	}

	function toggleNearMe() {
		showNearMe = !showNearMe;
		if (showNearMe) {
			if (userLat && userLon) {
				loadNearbyShops(userLat, userLon);
			} else {
				requestLocation();
			}
		} else {
			applyFiltersAndSort();
		}
	}

	function handleDistanceFilter(km: number | null) {
		distanceFilter = km;
		if (userLat && userLon) {
			loadNearbyShops(userLat, userLon);
		}
	}

	/** ---- SEARCH ---- **/
	function performSearch() {
		if (searchQuery.trim() === '') return;
		loadProducts(searchQuery);
	}

	/** ---- FILTER AND SORT ---- **/
	function applyFiltersAndSort() {
		let filtered = [...allProducts];

		// Apply price filter
		if (minPrice !== null && minPrice !== undefined) {
			const min = minPrice;
			filtered = filtered.filter((p) => p.price >= min);
		}
		if (maxPrice !== null && maxPrice !== undefined) {
			const max = maxPrice;
			filtered = filtered.filter((p) => p.price <= max);
		}

		// Apply sorting
		if (sortBy === 'price_asc') {
			filtered.sort((a, b) => a.price - b.price);
		} else if (sortBy === 'price_desc') {
			filtered.sort((a, b) => b.price - a.price);
		} else if (sortBy === 'distance_asc' && showNearMe && nearbyShops.length > 0) {
			// Sort by distance
			filtered.sort((a, b) => {
				const shopA = nearbyShops.find((s) => s.retailer.id === a.retailer_id);
				const shopB = nearbyShops.find((s) => s.retailer.id === b.retailer_id);
				const distA = shopA ? shopA.distance : Infinity;
				const distB = shopB ? shopB.distance : Infinity;
				return distA - distB;
			});
		}
		// "default" keeps original order (already sorted by backend)

		// Apply Near Me filter
		if (showNearMe && userLat && userLon) {
			const nearbyRetailerIds = new Set(nearbyShops.map((s) => s.retailer.id));
			filtered = filtered.filter((p) => p.retailer_id && nearbyRetailerIds.has(p.retailer_id));
		}

		// Preserve cart quantities from products array when filtering
		// Match by product ID to keep cart state
		const cartQuantityMap = new Map(
			products.map((p) => [p.id, { cartQty: p.cartQty, isQtyLoading: p.isQtyLoading }])
		);
		filtered = filtered.map((p) => {
			const cartData = cartQuantityMap.get(p.id);
			if (cartData) {
				p.cartQty = cartData.cartQty;
				p.isQtyLoading = cartData.isQtyLoading;
			}
			return p;
		});

		products = filtered;
	}

	function handleMinPriceChange(value: string) {
		minPrice = value === '' ? null : parseFloat(value);
		applyFiltersAndSort();
	}

	function handleMaxPriceChange(value: string) {
		maxPrice = value === '' ? null : parseFloat(value);
		applyFiltersAndSort();
	}

	function handleSortChange(newSort: string) {
		sortBy = newSort;
		applyFiltersAndSort();
	}

	function clearFilters() {
		minPrice = null;
		maxPrice = null;
		sortBy = 'default';
		showNearMe = false;
		distanceFilter = null;
		applyFiltersAndSort();
	}

	/** ------------------------------------------------------------------
	    ADD TO CART (unified logic with + button)
	   ------------------------------------------------------------------ **/
	async function addToCart(productId: number) {
		// Update in both products and allProducts to preserve state
		const p = products.find((p) => p.id === productId);
		const allP = allProducts.find((p) => p.id === productId);
		if (!p) return;

		// Start spinner immediately
		p.isQtyLoading = true;

		// Show quantity controls immediately
		if (p.cartQty === null) p.cartQty = 0;

		// Optimistic: pretend we're adding one - update both arrays
		const optimistic = p.cartQty + 1;
		p.cartQty = optimistic;
		if (allP) {
			allP.cartQty = optimistic;
			allP.isQtyLoading = true;
		}

		// Success toast stays as requested
		toast.success(`${p.name} added to cart`, { duration: 2000 });

		try {
			const res = await apiFetch('/api/cart/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					product_id: productId,
					quantity: 1
				})
			});

			if (!res.ok) throw new Error('Add to cart failed');

			const data = await res.json();

			p.cartQty = data.quantity; // backend truth
			p.isQtyLoading = false;
			if (allP) {
				allP.cartQty = data.quantity;
				allP.isQtyLoading = false;
			}
		} catch (err) {
			console.error(err);

			// Rollback - update both arrays
			p.cartQty = null;
			p.isQtyLoading = false;
			if (allP) {
				allP.cartQty = null;
				allP.isQtyLoading = false;
			}

			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error('Failed to add to cart');
			}
		}
	}

	/** ---- INCREASE QUANTITY ---- **/
	async function increaseQty(productId: number) {
		// Update in both products and allProducts to preserve state
		const p = products.find((p) => p.id === productId);
		const allP = allProducts.find((p) => p.id === productId);
		if (!p || p.cartQty === null) return;

		// Check stock limit before increasing
		if (p.cartQty >= p.stock_qty) {
			toast.error(`Only ${p.stock_qty} available in stock. Cannot add more.`);
			return;
		}

		const oldQty = p.cartQty;

		// Optimistic - update both arrays
		p.cartQty++;
		p.isQtyLoading = true;
		if (allP) {
			allP.cartQty = p.cartQty;
			allP.isQtyLoading = true;
		}

		try {
			const res = await apiFetch('/api/cart/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					product_id: productId,
					quantity: 1
				})
			});

			if (!res.ok) throw new Error('Failed to update quantity');

			const data = await res.json();
			p.cartQty = data.quantity;
			p.isQtyLoading = false;
			if (allP) {
				allP.cartQty = data.quantity;
				allP.isQtyLoading = false;
			}
		} catch (err) {
			console.error(err);
			p.cartQty = oldQty;
			p.isQtyLoading = false;
			if (allP) {
				allP.cartQty = oldQty;
				allP.isQtyLoading = false;
			}

			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error('Failed to update quantity');
			}
		}
	}

	/** ---- DECREASE QUANTITY ---- **/
	async function decreaseQty(productId: number) {
		// Update in both products and allProducts to preserve state
		const p = products.find((p) => p.id === productId);
		const allP = allProducts.find((p) => p.id === productId);
		if (!p || p.cartQty === null) return;

		const oldQty = p.cartQty;

		// optimistic - update both arrays
		p.cartQty--;
		p.isQtyLoading = true;
		if (allP) {
			allP.cartQty = p.cartQty;
			allP.isQtyLoading = true;
		}

		try {
			const res = await apiFetch('/api/cart/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					product_id: productId,
					quantity: -1
				})
			});

			if (!res.ok) throw new Error('Failed to update quantity');

			const data = await res.json();

			const newQty = data.quantity;
			p.cartQty = newQty <= 0 ? null : newQty;
			p.isQtyLoading = false;

			if (allP) {
				allP.cartQty = p.cartQty;
				allP.isQtyLoading = false;
			}
		} catch (err) {
			console.error(err);
			p.cartQty = oldQty;
			p.isQtyLoading = false;
			if (allP) {
				allP.cartQty = oldQty;
				allP.isQtyLoading = false;
			}

			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error('Failed to update quantity');
			}
		}
	}
</script>

<div class="min-h-screen bg-background">
	<header
		class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
	>
		<div class="container mx-auto grid h-16 grid-cols-3 items-center gap-4 px-4">
			<!-- Brand -->
			<div class="flex items-center">
				<button
					class="bg-linear-to-r from-white to-gray-400 bg-clip-text text-2xl font-extrabold tracking-wide text-transparent"
					onclick={() => loadProducts('')}
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
							if (e.key === 'Enter' && searchQuery.trim() !== '') {
								e.preventDefault();
								performSearch();
							}
						}}
					/>
				</div>

				<Button class="h-11 px-4" onclick={performSearch} disabled={searchQuery.trim() === ''}>
					<Search class="size-4 mr-2" /> Search
				</Button>
			</div>

			<!-- Cart & History -->
			<div class="flex justify-end gap-2">
				<Button variant="ghost" size="icon" href={resolve('/orders')} title="Order History">
					<History class="size-5" />
				</Button>
				<Button variant="ghost" size="icon" href={resolve('/cart')} title="Cart">
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

		<!-- Filters and Sort -->
		<div class="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
			<!-- Near Me Button -->
			<!-- Near Me Button -->
			<Button
				variant={showNearMe ? 'default' : 'outline'}
				size="sm"
				onclick={toggleNearMe}
				disabled={locationLoading ||
					shopsLoading ||
					(!userLat && !userLon && locationPermission === 'denied')}
			>
				{#if locationLoading || shopsLoading}
					<Loader2 class="size-4 mr-2 animate-spin" />
				{:else}
					<Navigation class="size-4 mr-2" />
				{/if}
				Near Me
			</Button>

			{#if showNearMe && userLat && userLon}
				<!-- Distance Filter -->
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium text-muted-foreground">Within:</span>
					<select
						class="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
						value={distanceFilter?.toString() ?? '10'}
						onchange={(e) =>
							handleDistanceFilter(
								e.currentTarget.value ? parseFloat(e.currentTarget.value) : null
							)}
					>
						<option value="1">1 km</option>
						<option value="3">3 km</option>
						<option value="5">5 km</option>
						<option value="10">10 km</option>
						<option value="25">25 km</option>
						<option value="50">50 km</option>
					</select>
				</div>
			{/if}

			<!-- Price Filter -->
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-muted-foreground">Price:</span>
				<Input
					type="number"
					placeholder="Min"
					class="w-24"
					value={minPrice?.toString() ?? ''}
					oninput={(e) => handleMinPriceChange(e.currentTarget.value)}
				/>
				<span class="text-muted-foreground">-</span>
				<Input
					type="number"
					placeholder="Max"
					class="w-24"
					value={maxPrice?.toString() ?? ''}
					oninput={(e) => handleMaxPriceChange(e.currentTarget.value)}
				/>
			</div>

			<!-- Sort -->
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-muted-foreground">Sort:</span>
				<select
					class="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					value={sortBy}
					onchange={(e) => handleSortChange(e.currentTarget.value)}
				>
					<option value="default">Default</option>
					<option value="price_asc">Price: Low to High</option>
					<option value="price_desc">Price: High to Low</option>
					{#if showNearMe && userLat && userLon}
						<option value="distance_asc">Distance: Nearest First</option>
					{/if}
				</select>
			</div>

			<!-- Clear Filters -->
			{#if minPrice !== null || maxPrice !== null || sortBy !== 'default' || showNearMe}
				<Button variant="outline" size="sm" onclick={clearFilters}>Clear Filters</Button>
			{/if}

			<!-- Results count -->
			<div class="ml-auto text-sm text-muted-foreground">
				Showing {products.length} of {allProducts.length} products
			</div>
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
						<a
							href="/shop/{product.id}"
							class="block relative aspect-square w-full overflow-hidden bg-muted"
						>
							<img
								src={product.image}
								alt={product.name}
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
									<Card.Description class="text-sm text-destructive">Out of stock</Card.Description>
								{/if}

								{#if showNearMe && nearbyShops.length > 0 && product.retailer_id}
									{@const shop = nearbyShops.find((s) => s.retailer.id === product.retailer_id)}
									{#if shop}
										<div class="flex items-center gap-1 text-xs text-muted-foreground mt-1">
											<MapPin class="size-3" />
											<span>{shop.distance.toFixed(1)} km away</span>
											{#if shop.eta > 0}
												<span>• ~{Math.round(shop.eta)} min</span>
											{/if}
										</div>
									{/if}
								{/if}
							</Card.Header>

							<Card.Footer class="flex items-center justify-between p-0 pt-4">
								<span class="text-xl font-bold">₹{product.price.toFixed(2)}</span>

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
											disabled={product.isQtyLoading ||
												(product.cartQty !== null && product.cartQty >= product.stock_qty)}
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
