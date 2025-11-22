<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Loader2, Package, History, ShoppingCart } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { apiFetch } from '$lib/api';
	import { resolve } from '$app/paths';

	interface OrderItem {
		id: number;
		order_id: number;
		product_id: number;
		qty: number;
		unit_price: number;
		status: string;
	}

	interface ConsumerOrder {
		id: number;
		consumer_id: number;
		payment_method: string;
		payment_status: string;
		order_status: string;
		total_amount: number;
		scheduled_at: string | null;
		address_id: number | null;
		created_at: string;
		updated_at: string;
		items: OrderItem[];
	}

	let loading = $state(true);
	let orders = $state<ConsumerOrder[]>([]);
	let errorMessage = $state<string | null>(null);

	onMount(() => {
		loadOrders();
	});

	async function loadOrders() {
		loading = true;
		errorMessage = null;

		try {
			const res = await apiFetch('/api/consumer/orders');

			if (!res.ok) throw new Error('Failed to fetch orders');

			const data = await res.json();
			orders = Array.isArray(data.orders) ? data.orders : [];
		} catch (err) {
			console.error(err);
			errorMessage = 'Failed to load orders';
			orders = [];
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) {
				return dateString;
			}
			return date.toLocaleString('en-IN', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			});
		} catch (err) {
			return dateString;
		}
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
			accepted: 'bg-blue-100 text-blue-800 border-blue-200',
			shipped: 'bg-purple-100 text-purple-800 border-purple-200',
			delivered: 'bg-green-100 text-green-800 border-green-200',
			rejected: 'bg-red-100 text-red-800 border-red-200'
		};
		return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
	}

	function isOrderOngoing(order: ConsumerOrder): boolean {
		// An order is ongoing if it has at least one item that is not delivered or rejected
		return order.items.some(item => item.status !== 'delivered' && item.status !== 'rejected');
	}

	// Separate orders into ongoing and past
	const ongoingOrders = $derived(orders.filter(order => isOrderOngoing(order)));
	const pastOrders = $derived(orders.filter(order => !isOrderOngoing(order)));
</script>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight mb-2">Order History</h1>
			<p class="text-muted-foreground">View all your ongoing and past orders</p>
		</div>
		<Button variant="outline" href={resolve('/cart')}>
			<ShoppingCart class="size-4 mr-2" />
			Cart
		</Button>
	</div>

	{#if loading}
		<div class="space-y-6">
			{#each Array(3) as _}
				<Card.Root>
					<Card.Content class="p-6">
						<Skeleton class="h-6 w-1/4 mb-4" />
						<Skeleton class="h-4 w-full mb-2" />
						<Skeleton class="h-4 w-3/4" />
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{:else if errorMessage}
		<Card.Root>
			<Card.Content class="p-12 text-center">
				<p class="text-destructive">{errorMessage}</p>
				<Button onclick={loadOrders} class="mt-4">Retry</Button>
			</Card.Content>
		</Card.Root>
	{:else if orders.length === 0}
		<Card.Root>
			<Card.Content class="p-12 text-center">
				<Package class="size-12 mx-auto mb-4 text-muted-foreground" />
				<p class="text-lg font-medium mb-2">No orders yet</p>
				<p class="text-muted-foreground mb-4">Your orders will appear here.</p>
				<Button href={resolve('/shop')}>Browse Products</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-8">
			<!-- Ongoing Orders -->
			{#if ongoingOrders.length > 0}
				<div>
					<h2 class="text-2xl font-bold mb-4">Ongoing Orders</h2>
					<div class="space-y-6">
						{#each ongoingOrders as order (order.id)}
							<Card.Root class="overflow-hidden rounded-xl border shadow-sm">
								<Card.Header class="flex justify-between bg-muted/40 px-6 py-4">
									<div>
										<h2 class="text-lg font-semibold">Order #{order.id}</h2>
										<p class="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
									</div>
									<div class="text-right">
										<p class="text-sm font-medium">Total: ₹{order.total_amount.toFixed(2)}</p>
										<p class="text-xs text-muted-foreground">
											{order.payment_method === 'online' ? 'Online' : 'Offline'} Payment
										</p>
									</div>
								</Card.Header>

								<Card.Content class="space-y-4 px-6 py-4">
									{#each order.items as item (item.id)}
										<div class="rounded-lg border bg-card p-4 shadow-sm">
											<div class="mb-3 flex items-center justify-between">
												<div>
													<p class="font-medium">Product #{item.product_id}</p>
													<p class="text-sm text-muted-foreground">
														Quantity: {item.qty} × ₹{item.unit_price.toFixed(2)}
													</p>
												</div>
												<div
													class="rounded-full border px-3 py-1 text-xs font-medium {getStatusColor(
														item.status
													)}"
												>
													{item.status.charAt(0).toUpperCase() + item.status.slice(1)}
												</div>
											</div>
										</div>
									{/each}
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Past Orders -->
			{#if pastOrders.length > 0}
				<div>
					<h2 class="text-2xl font-bold mb-4">Past Orders</h2>
					<div class="space-y-6">
						{#each pastOrders as order (order.id)}
							<Card.Root class="overflow-hidden rounded-xl border shadow-sm">
								<Card.Header class="flex justify-between bg-muted/40 px-6 py-4">
									<div>
										<h2 class="text-lg font-semibold">Order #{order.id}</h2>
										<p class="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
									</div>
									<div class="text-right">
										<p class="text-sm font-medium">Total: ₹{order.total_amount.toFixed(2)}</p>
										<p class="text-xs text-muted-foreground">
											{order.payment_method === 'online' ? 'Online' : 'Offline'} Payment
										</p>
									</div>
								</Card.Header>

								<Card.Content class="space-y-4 px-6 py-4">
									{#each order.items as item (item.id)}
										<div class="rounded-lg border bg-card p-4 shadow-sm">
											<div class="mb-3 flex items-center justify-between">
												<div>
													<p class="font-medium">Product #{item.product_id}</p>
													<p class="text-sm text-muted-foreground">
														Quantity: {item.qty} × ₹{item.unit_price.toFixed(2)}
													</p>
												</div>
												<div
													class="rounded-full border px-3 py-1 text-xs font-medium {getStatusColor(
														item.status
													)}"
												>
													{item.status.charAt(0).toUpperCase() + item.status.slice(1)}
												</div>
											</div>
										</div>
									{/each}
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

