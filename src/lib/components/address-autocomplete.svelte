<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Loader2, MapPin } from '@lucide/svelte';
	import { onMount } from 'svelte';

	interface GeocodeResult {
		latitude: number;
		longitude: number;
		display_name: string;
		address: {
			street_address: string;
			city: string;
			state: string;
			postcode: string;
			country: string;
		};
	}

	interface Props {
		value?: string;
		onSelect?: (result: GeocodeResult) => void;
	}

	let { value = $bindable(''), onSelect = () => {} }: Props = $props();

	let query = $state<string>('');
	let results = $state<GeocodeResult[]>([]);
	let loading = $state<boolean>(false);
	let showResults = $state<boolean>(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Debounce search (300ms as per requirements)
	function searchAddresses(searchQuery: string) {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		if (!searchQuery.trim()) {
			results = [];
			showResults = false;
			return;
		}

		debounceTimer = setTimeout(async () => {
			loading = true;
			try {
				const params = new URLSearchParams({
					q: searchQuery,
					format: 'json',
					addressdetails: '1',
					limit: '5'
				});

				const response = await fetch(
					`https://nominatim.openstreetmap.org/search?${params.toString()}`,
					{
						headers: {
							'User-Agent': 'Obsonarium/1.0 (https://obsonarium.com)'
						}
					}
				);

				if (!response.ok) {
					throw new Error('Geocoding failed');
				}

				const data = await response.json();
				results = data.map((item: any) => ({
					latitude: parseFloat(item.lat),
					longitude: parseFloat(item.lon),
					display_name: item.display_name,
					address: {
						street_address: `${item.address?.house_number || ''} ${item.address?.road || ''}`.trim(),
						city: item.address?.city || item.address?.town || item.address?.village || '',
						state: item.address?.state || '',
						postcode: item.address?.postcode || '',
						country: item.address?.country || ''
					}
				}));
				showResults = true;
			} catch (error) {
				console.error('Error searching addresses:', error);
				results = [];
			} finally {
				loading = false;
			}
		}, 300);
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		query = target.value;
		value = target.value;
		searchAddresses(query);
	}

	function selectResult(result: GeocodeResult) {
		value = result.display_name;
		query = result.display_name;
		showResults = false;
		results = [];
		onSelect(result);
	}

	function handleBlur() {
		// Delay hiding results to allow click events
		setTimeout(() => {
			showResults = false;
		}, 200);
	}
</script>

<div class="relative w-full">
	<div class="relative">
		<MapPin class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
		<Input
			type="text"
			placeholder="Search for an address..."
			value={query}
			oninput={handleInput}
			onblur={handleBlur}
			class="pl-10"
		/>
		{#if loading}
			<Loader2 class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
		{/if}
	</div>

	{#if showResults && results.length > 0}
		<div
			class="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
			role="listbox"
		>
			{#each results as result (result.latitude + result.longitude)}
				<button
					type="button"
					class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
					onclick={() => selectResult(result)}
					role="option"
				>
					<div class="font-medium">{result.display_name}</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

