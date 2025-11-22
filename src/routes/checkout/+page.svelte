<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Loader2, Plus, MapPin, ShoppingBag } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { toast } from 'svelte-sonner';
	import { apiFetch } from '$lib/api';

	interface CartItem {
		id: number;
		product_id: number;
		quantity: number;
		name: string;
		price: number;
		image: string;
	}

	interface Address {
		id: number;
		label: string;
		street_address: string;
		city: string;
		state: string;
		postal_code: string;
		country: string;
	}

	let loadingCart = $state(true);
	let loadingAddresses = $state(true);
	let cartItems = $state<CartItem[]>([]);
	let addresses = $state<Address[]>([]);
	let selectedAddressId = $state<number | null>(null);
	let showAddressForm = $state(false);
	let placingOrder = $state(false);

	// New address form fields
	let newAddress = $state({
		label: '',
		street_address: '',
		city: '',
		state: '',
		postal_code: '',
		country: 'India'
	});

	let total = $derived(cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0));

	onMount(() => {
		loadCart();
		loadAddresses();
	});

	async function loadCart() {
		loadingCart = true;
		try {
			const res = await apiFetch('/api/cart');
			if (!res.ok) throw new Error('Failed to fetch cart');

			const data = await res.json();
			const raw = Array.isArray(data.cart) ? data.cart : [];

			cartItems = raw.map((row: any): CartItem => {
				const p = row.product || {};
				return {
					id: row.id,
					product_id: row.product_id,
					quantity: row.quantity,
					name: p.name ?? 'Unknown Product',
					price: Number(p.price ?? 0),
					image: p.image_url ?? '/placeholder.png'
				};
			});

			// Redirect to cart if empty
			if (cartItems.length === 0) {
				toast.error('Your cart is empty');
				goto('/cart');
			}
		} catch (err) {
			console.error(err);
			toast.error('Failed to load cart');
			goto('/cart');
		} finally {
			loadingCart = false;
		}
	}

	async function loadAddresses() {
		loadingAddresses = true;
		try {
			const res = await apiFetch('/api/addresses');
			if (!res.ok) throw new Error('Failed to fetch addresses');

			const data = await res.json();
			addresses = Array.isArray(data.addresses) ? data.addresses : [];

			// Auto-select first address if available
			if (addresses.length > 0 && !selectedAddressId) {
				selectedAddressId = addresses[0].id;
			}
		} catch (err) {
			console.error(err);
			toast.error('Failed to load addresses');
		} finally {
			loadingAddresses = false;
		}
	}

	async function addNewAddress() {
		// Validate required fields
		if (!newAddress.street_address.trim()) {
			toast.error('Street address is required');
			return;
		}
		if (!newAddress.city.trim()) {
			toast.error('City is required');
			return;
		}
		if (!newAddress.postal_code.trim()) {
			toast.error('Postal code is required');
			return;
		}
		if (!newAddress.country.trim()) {
			toast.error('Country is required');
			return;
		}

		try {
			const res = await apiFetch('/api/addresses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newAddress)
			});

			if (!res.ok) throw new Error('Failed to add address');

			const data = await res.json();
			const addedAddress = data.address;

			addresses = [...addresses, addedAddress];
			selectedAddressId = addedAddress.id;

			// Reset form
			newAddress = {
				label: '',
				street_address: '',
				city: '',
				state: '',
				postal_code: '',
				country: 'India'
			};
			showAddressForm = false;

			toast.success('Address added successfully');
		} catch (err) {
			if (err instanceof Error && err.message !== 'Unauthorized') {
				toast.error('Failed to add address');
			}
		}
	}

	async function handlePlaceOrder() {
		if (!selectedAddressId) {
			toast.error('Please select a delivery address');
			return;
		}

		placingOrder = true;

		// Placeholder for future payment integration
		setTimeout(() => {
			placingOrder = false;
			toast.info('Payment integration coming soon! Your order is ready to be processed.');
		}, 1000);
	}
</script>

<main class="container mx-auto px-4 py-8 max-w-6xl">
	<div class="flex gap-6">
		<!-- LEFT: ADDRESS SELECTION -->
		<div class="flex-1 bg-card border rounded-xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
			<h2 class="text-xl font-semibold mb-4">Select Delivery Address</h2>

			<!-- Address List -->
			{#if addresses.length > 0}
				<div class="flex flex-col gap-4">
					{#each addresses as address}
						<label
							class="flex items-start gap-4 p-6 border rounded-xl cursor-pointer hover:border-primary transition bg-card/50"
						>
							<input
								type="radio"
								name="address"
								value={address.id}
								bind:group={selectedAddressId}
								class="mt-1 size-4"
							/>

							<div class="space-y-1">
								<p class="font-semibold text-lg">{address.label || 'Address'}</p>
								<p class="text-muted-foreground text-base">
									{address.street_address}, {address.city}
									{address.state ? `, ${address.state}` : ''} - {address.postal_code}
								</p>
								<p class="text-sm uppercase text-muted-foreground font-medium">{address.country}</p>
							</div>
						</label>
					{/each}
				</div>
			{:else}
				<p class="text-muted-foreground">No addresses saved yet.</p>
			{/if}

			<!-- Add Address Button -->
			{#if !showAddressForm}
				<Button class="w-full mt-6 h-12 text-base" onclick={() => (showAddressForm = true)}
					>Add New Address</Button
				>
			{/if}

			<!-- Address Form -->
			{#if showAddressForm}
				<div class="border rounded-xl p-6 space-y-4 mt-6 bg-muted/30">
					<div class="flex items-center justify-between mb-2">
						<h3 class="font-semibold text-lg">New Address</h3>
					</div>

					<div class="space-y-4">
						<div class="grid gap-2">
							<Label>Label (Optional)</Label>
							<Input placeholder="Home, Work, etc." bind:value={newAddress.label} class="h-11" />
						</div>

						<div class="grid gap-2">
							<Label>Street Address</Label>
							<Input
								placeholder="House No., Street Name"
								bind:value={newAddress.street_address}
								class="h-11"
							/>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="grid gap-2">
								<Label>City</Label>
								<Input placeholder="City" bind:value={newAddress.city} class="h-11" />
							</div>
							<div class="grid gap-2">
								<Label>State</Label>
								<Input placeholder="State" bind:value={newAddress.state} class="h-11" />
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="grid gap-2">
								<Label>Postal Code</Label>
								<Input placeholder="PIN Code" bind:value={newAddress.postal_code} class="h-11" />
							</div>
							<div class="grid gap-2">
								<Label>Country</Label>
								<Input placeholder="Country" bind:value={newAddress.country} class="h-11" />
							</div>
						</div>
					</div>

					<div class="flex gap-3 pt-2">
						<Button class="flex-1 h-11" onclick={addNewAddress}>Save Address</Button>
						<Button variant="outline" class="flex-1 h-11" onclick={() => (showAddressForm = false)}
							>Cancel</Button
						>
					</div>
				</div>
			{/if}
		</div>

		<!-- RIGHT: ORDER SUMMARY -->
		<div class="w-[32%] sticky top-10">
			<div class="border bg-card rounded-xl p-6 space-y-4 shadow">
				<h2 class="text-xl font-semibold">Order Summary</h2>

				<div class="flex justify-between text-sm">
					<span class="text-muted-foreground">Subtotal</span>
					<span>₹{total.toFixed(2)}</span>
				</div>

				<div class="flex justify-between text-sm">
					<span class="text-muted-foreground">Tax</span>
					<span>₹0.00</span>
				</div>

				<hr />

				<div class="flex justify-between items-center">
					<p class="font-bold text-lg">Total</p>
					<p class="text-2xl font-bold">₹{total.toFixed(2)}</p>
				</div>

				<Button
					class="w-full h-12 text-base mt-4"
					disabled={!selectedAddressId || placingOrder}
					onclick={handlePlaceOrder}
				>
					{#if placingOrder}
						<Loader2 class="size-4 animate-spin mr-2" /> Processing…
					{:else}
						Place Order
					{/if}
				</Button>
			</div>
		</div>
	</div>
</main>
