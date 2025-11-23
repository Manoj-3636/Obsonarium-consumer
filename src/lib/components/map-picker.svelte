<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { MapPin } from '@lucide/svelte';
	import type { Map as LeafletMap, Marker as LeafletMarker, LayerGroup } from 'leaflet';

	interface Props {
		latitude?: number | null;
		longitude?: number | null;
		onLocationChange?: (lat: number, lon: number) => void;
		autoCenterOnLocation?: boolean;
	}

	let {
		latitude = $bindable<number | null>(null),
		longitude = $bindable<number | null>(null),
		onLocationChange = () => {},
		autoCenterOnLocation = false
	}: Props = $props();

	// Element bindings in Svelte 5 use `let`, not `$state()` - this is correct
	// The warning is a false positive - element bindings are handled specially by Svelte
	let mapContainer = $state<HTMLDivElement>();
	let map: LeafletMap | null = null;
	let marker: LeafletMarker | null = null;
	let initialLat = latitude || 28.6139; // Default to Delhi
	let initialLon = longitude || 77.209;
	let L: any = null;
	let isClient = $state(false);
	let mapInitialized = $state(false);
	let gettingLocation = $state(false);

	// Get current location
	async function getCurrentLocation(): Promise<{ lat: number; lon: number } | null> {
		return new Promise((resolve) => {
			if (!browser || !navigator.geolocation) {
				resolve(null);
				return;
			}

			gettingLocation = true;
			navigator.geolocation.getCurrentPosition(
				(position) => {
					gettingLocation = false;
					resolve({
						lat: position.coords.latitude,
						lon: position.coords.longitude
					});
				},
				(error) => {
					gettingLocation = false;
					console.error('Error getting location:', error);
					resolve(null);
				},
				{
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 0
				}
			);
		});
	}

	// Initialize map when container is available
	async function initializeMap() {
		if (!browser || !L || mapInitialized) return;

		// Wait for DOM to be ready and container to be available
		await tick();

		// Retry if container not available yet
		if (!mapContainer) {
			// Wait a bit more for the element to be bound
			await new Promise((resolve) => setTimeout(resolve, 100));
			if (!mapContainer) return;
		}

		// Fix for Leaflet default icon path
		delete (L.Icon.Default.prototype as any)._getIconUrl;
		L.Icon.Default.mergeOptions({
			iconRetinaUrl:
				'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
			iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
			shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
		});

		// Get current location if requested and no coordinates provided
		if (autoCenterOnLocation && !latitude && !longitude) {
			const currentLoc = await getCurrentLocation();
			if (currentLoc) {
				initialLat = currentLoc.lat;
				initialLon = currentLoc.lon;
				latitude = currentLoc.lat;
				longitude = currentLoc.lon;
			}
		}

		if (mapContainer && L) {
			// Ensure container has dimensions
			if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
				console.warn('Map container has no dimensions, retrying...');
				setTimeout(() => initializeMap(), 200);
				return;
			}

			map = L.map(mapContainer, {
				center: [initialLat, initialLon],
				zoom: latitude && longitude ? 15 : 10
			});

			const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© OpenStreetMap contributors',
				maxZoom: 19
			});
			if (map) {
				tileLayer.addTo(map);
				// Invalidate size to ensure proper rendering
				setTimeout(() => {
					if (map) {
						map.invalidateSize();
					}
				}, 100);
			}

			// Add marker if coordinates provided
			if (latitude && longitude && map && L) {
				const newMarker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
				marker = newMarker as any;
				map.setView([latitude, longitude], 15);

				newMarker.on('dragend', async () => {
					if (newMarker) {
						const position = newMarker.getLatLng();
						latitude = position.lat;
						longitude = position.lng;
						onLocationChange(position.lat, position.lng);

						// Reverse geocode on drag
						try {
							const response = await fetch(
								`https://nominatim.openstreetmap.org/reverse?lat=${position.lat}&lon=${position.lng}&format=json`,
								{
									headers: {
										'User-Agent': 'Obsonarium/1.0 (https://obsonarium.com)'
									}
								}
							);
							if (response.ok) {
								const data = await response.json();
								// You can emit this to parent if needed
								console.log('Address:', data.display_name);
							}
						} catch (error) {
							console.error('Reverse geocoding failed:', error);
						}
					}
				});
			} else if (map && L) {
				// Add click handler to place marker
				map.on('click', async (e) => {
					const { lat, lng } = e.latlng;
					latitude = lat;
					longitude = lng;

					if (marker && map) {
						marker.setLatLng([lat, lng]);
					} else if (map && L) {
						const newMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
						marker = newMarker as any;
						newMarker.on('dragend', async () => {
							if (newMarker) {
								const position = newMarker.getLatLng();
								latitude = position.lat;
								longitude = position.lng;
								onLocationChange(position.lat, position.lng);
							}
						});
					}

					onLocationChange(lat, lng);

					// Reverse geocode on click
					try {
						const response = await fetch(
							`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
							{
								headers: {
									'User-Agent': 'Obsonarium/1.0 (https://obsonarium.com)'
								}
							}
						);
						if (response.ok) {
							const data = await response.json();
							console.log('Address:', data.display_name);
						}
					} catch (error) {
						console.error('Reverse geocoding failed:', error);
					}
				});
			}
		}

		mapInitialized = true;
	}

	// Fix Leaflet default icon issue
	onMount(async () => {
		if (!browser) return;

		// Dynamically import Leaflet only on client side
		const leafletModule = await import('leaflet');
		L = leafletModule.default;
		await import('leaflet/dist/leaflet.css');

		isClient = true;

		// Initialize map after DOM is ready
		await tick();
		await initializeMap();
	});

	// Watch for mapContainer to become available
	$effect(() => {
		if (isClient && L && mapContainer && !mapInitialized) {
			// Use setTimeout to ensure DOM is fully rendered
			setTimeout(() => {
				initializeMap();
			}, 0);
		}
	});

	onDestroy(() => {
		if (map) {
			map.remove();
		}
	});

	// Update marker position when props change externally
	$effect(() => {
		if (map && marker && L && latitude !== null && longitude !== null) {
			marker.setLatLng([latitude, longitude]);
			map.setView([latitude, longitude], 15);
		}
	});

	// Expose function to center on current location (accessible via bind:this)
	export async function centerOnCurrentLocation() {
		const currentLoc = await getCurrentLocation();
		if (currentLoc && map) {
			latitude = currentLoc.lat;
			longitude = currentLoc.lon;
			map.setView([currentLoc.lat, currentLoc.lon], 15);

			// Add or update marker
			if (marker && map) {
				marker.setLatLng([currentLoc.lat, currentLoc.lon]);
			} else if (map && L) {
				const newMarker = L.marker([currentLoc.lat, currentLoc.lon], { draggable: true }).addTo(
					map
				);
				marker = newMarker as any;
				newMarker.on('dragend', async () => {
					if (newMarker) {
						const position = newMarker.getLatLng();
						latitude = position.lat;
						longitude = position.lng;
						onLocationChange(position.lat, position.lng);
					}
				});
			}

			onLocationChange(currentLoc.lat, currentLoc.lon);
			return currentLoc;
		}
		return null;
	}
</script>

{#if isClient}
	<div class="w-full rounded-lg border overflow-hidden" style="height: 400px;">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore non_reactive_update -->
		<div bind:this={mapContainer} class="w-full h-full"></div>
	</div>

	{#if latitude && longitude}
		<div class="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
			<MapPin class="h-4 w-4" />
			<span>Lat: {latitude.toFixed(6)}, Lon: {longitude.toFixed(6)}</span>
		</div>
	{/if}
{:else}
	<div
		class="w-full rounded-lg border overflow-hidden flex items-center justify-center"
		style="height: 400px;"
	>
		<div class="text-muted-foreground">Loading map...</div>
	</div>
{/if}
