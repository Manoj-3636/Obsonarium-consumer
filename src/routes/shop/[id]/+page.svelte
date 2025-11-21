<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { ArrowLeft, Loader2, Star } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';
	import { apiFetch } from '$lib/api';

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

	// Reviews state
	interface Review {
		id: number;
		user_id: number;
		rating: number;
		comment: string;
		created_at: string;
	}

	let reviews = $state<Review[]>([]);
	let reviewsLoading = $state(false);
	let showReviewForm = $state(false);
	let reviewRating = $state(5);
	let reviewComment = $state('');
	let submittingReview = $state(false);
	let checkingAuth = $state(false);

	$effect(() => {
		const id = $page.params.id;
		if (id) {
			loadProduct(id);
		}
	});

	async function loadProduct(id: string) {
		if (currentFetch) currentFetch.abort();
		currentFetch = new AbortController();

		loading = true;
		error = null;

		try {
			const res = await fetch(`/api/shop/${id}`, { signal: currentFetch.signal });
			if (!res.ok) throw new Error('Failed to fetch');

			const data = await res.json();

			product = {
				id: data.product.id,
				name: data.product.name,
				price: data.product.price,
				image: data.product.image_url,
				stock_qty: data.product.stock_qty,
				retailer_id: data.product.retailer_id,
				description: data.product.description,
				cartQty: null,
				isQtyLoading: false
			};

			// Retailer info
			const r = await fetch(`/api/retailers/${product.retailer_id}`, {
				signal: currentFetch.signal
			});
			if (r.ok) {
				retailerName = (await r.json()).retailer.business_name;
			}

			// Load reviews
			loadReviews(product.id);
		} catch (err) {
			if (!(err instanceof Error) || err.name !== 'AbortError') {
				error = 'Failed to load product details';
			}
		} finally {
			loading = false;
			currentFetch = null;
		}
	}

	async function loadReviews(productId: number) {
		reviewsLoading = true;
		try {
			const res = await fetch(`/api/products/${productId}/reviews`);
			if (res.ok) {
				const data = await res.json();
				reviews = data.reviews || [];
			}
		} catch (err) {
			console.error('Failed to load reviews:', err);
		} finally {
			reviewsLoading = false;
		}
	}

	async function handleLeaveFeedback() {
		if (!product) return;

		checkingAuth = true;

		try {
			// Check if user is authenticated by making a request to a protected endpoint
			const res = await fetch('/api/cart/number', {
				credentials: 'include'
			});

			if (res.status === 401) {
				// User is not authenticated, redirect to signin
				toast.error('Please log in to leave feedback');
				
				// Store the current page URL so we can redirect back after login
				const currentUrl = window.location.pathname + window.location.search;
				sessionStorage.setItem('redirectAfterLogin', currentUrl);
				
				window.location.href = '/signin';
				return;
			}

			// User is authenticated, show the form
			showReviewForm = true;
		} catch (err) {
			console.error('Failed to check authentication:', err);
			toast.error('Failed to check authentication');
		} finally {
			checkingAuth = false;
		}
	}

	async function submitReview() {
		if (!product || !reviewComment.trim()) {
			toast.error('Please enter a comment');
			return;
		}

		if (reviewRating < 1 || reviewRating > 5) {
			toast.error('Please select a rating');
			return;
		}

		submittingReview = true;

		try {
			const res = await apiFetch(`/api/products/${product.id}/reviews`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					rating: reviewRating,
					comment: reviewComment.trim()
				})
			});

			if (!res.ok) throw new Error('Failed to submit review');

			toast.success('Review submitted successfully!');
			
			// Reset form
			reviewRating = 5;
			reviewComment = '';
			showReviewForm = false;

			// Reload reviews
			await loadReviews(product.id);
		} catch (err) {
			// Don't show error toast if it's an Unauthorized error (already shown by apiFetch)
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error('Failed to submit review');
			}
		} finally {
			submittingReview = false;
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
			const res = await apiFetch('/api/cart/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
				toast.error('Failed to add to cart');
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
			const res = await apiFetch('/api/cart/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
				toast.error('Failed to update quantity');
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
			const res = await apiFetch('/api/cart/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
				toast.error('Failed to update quantity');
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
				<p class="text-3xl font-bold">₹{product.price.toFixed(2)}</p>
				<p class="text-muted-foreground">{product.description}</p>

				<!-- CART CONTROLS -->
				<div class="flex gap-3">
					{#if product.cartQty === null}
						<Button size="lg" class="flex-1" disabled={product.stock_qty === 0} onclick={addToCart}>
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

		<!-- Reviews Section -->
		<div class="mt-12 space-y-6">
			<div class="flex items-center justify-between">
				<h2 class="text-2xl font-bold">Reviews ({reviews.length})</h2>
				<Button onclick={handleLeaveFeedback} disabled={checkingAuth}>
					{#if checkingAuth}
						<Loader2 class="size-4 mr-2 animate-spin" />
					{/if}
					Leave Feedback
				</Button>
			</div>

			<!-- Review Form -->
			{#if showReviewForm}
				<Card.Root>
					<Card.Header>
						<Card.Title>Write a Review</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div>
							<Label>Rating</Label>
							<div class="flex gap-2 mt-2">
								{#each Array(5) as _, i}
									<button
										type="button"
										onclick={() => (reviewRating = i + 1)}
										class="focus:outline-none"
									>
										<Star
											class="size-6 transition-colors {reviewRating >= i + 1
												? 'fill-yellow-400 text-yellow-400'
												: 'text-muted-foreground'}"
										/>
									</button>
								{/each}
								<span class="ml-2 text-sm text-muted-foreground">{reviewRating} out of 5</span>
							</div>
						</div>

						<div>
							<Label for="review-comment">Comment</Label>
							<textarea
								id="review-comment"
								bind:value={reviewComment}
								placeholder="Share your experience with this product..."
								class="w-full min-h-[100px] mt-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							></textarea>
						</div>

						<div class="flex gap-2">
							<Button onclick={submitReview} disabled={submittingReview}>
								{#if submittingReview}
									<Loader2 class="size-4 mr-2 animate-spin" />
								{/if}
								Submit Review
							</Button>
							<Button variant="outline" onclick={() => (showReviewForm = false)}>Cancel</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Reviews List -->
			{#if reviewsLoading}
				<div class="space-y-4">
					{#each Array(3) as _}
						<Card.Root>
							<Card.Content class="p-4">
								<Skeleton class="h-6 w-1/4 mb-2" />
								<Skeleton class="h-4 w-full mb-2" />
								<Skeleton class="h-4 w-3/4" />
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			{:else if reviews.length === 0}
				<Card.Root>
					<Card.Content class="p-6 text-center text-muted-foreground">
						<p>No reviews yet. Be the first to leave feedback!</p>
					</Card.Content>
				</Card.Root>
			{:else}
				<div class="space-y-4">
					{#each reviews as review (review.id)}
						<Card.Root>
							<Card.Content class="p-4">
								<div class="flex items-center gap-2 mb-2">
									<div class="flex gap-1">
										{#each Array(5) as _, i}
											<Star
												class="size-4 {review.rating > i
													? 'fill-yellow-400 text-yellow-400'
													: 'text-muted-foreground'}"
											/>
										{/each}
									</div>
									<span class="text-sm text-muted-foreground">
										{new Date(review.created_at).toLocaleDateString()}
									</span>
								</div>
								<p class="text-sm whitespace-pre-wrap">{review.comment}</p>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</main>
