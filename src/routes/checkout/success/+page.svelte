<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { ShoppingBag, CheckCircle2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	let orderId = $state<string | null>(null);

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		orderId = urlParams.get('order_id');
		
		if (orderId) {
			toast.success('Payment successful! Your order has been placed.');
		}
	});

	// Calculate delivery date (2 days from now)
	const deliveryDate = $derived(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
	
	// Generate Google Calendar URL
	const googleCalendarUrl = $derived(() => {
		const startDate = new Date(deliveryDate);
		startDate.setHours(10, 0, 0, 0);
		const endDate = new Date(startDate);
		endDate.setHours(11, 0, 0, 0);
		
		const formatDate = (date: Date) => {
			// Convert to UTC and format as YYYYMMDDTHHMMSSZ
			const iso = date.toISOString();
			return iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
		};
		
		const dates = `${formatDate(startDate)}/${formatDate(endDate)}`;
		const title = encodeURIComponent('Order Delivery');
		const details = encodeURIComponent(`Your order will be delivered on ${deliveryDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
		
		return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
	});
</script>

<main class="container mx-auto px-4 py-8 max-w-6xl">
	<div
		class="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in zoom-in-95 duration-500"
	>
		<div
			class="size-24 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4"
		>
			<CheckCircle2 class="size-12" />
		</div>
		<h1 class="text-3xl font-bold text-center">Payment Successful!</h1>
		<p class="text-muted-foreground text-center max-w-md">
			Thank you for your purchase. Your order has been received and will be processed shortly.
			{#if orderId}
				<br />
				<span class="font-medium">Order ID: #{orderId}</span>
			{/if}
		</p>
		<div class="pt-6 flex flex-col items-center gap-4">
			<a
				href={googleCalendarUrl()}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
			>
				<svg class="size-5" viewBox="0 0 24 24" fill="currentColor">
					<path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
				</svg>
				Add Delivery to Google Calendar
			</a>
			<Button href="/shop" class="h-12 px-8 text-lg">Continue Shopping</Button>
		</div>
	</div>
</main>

