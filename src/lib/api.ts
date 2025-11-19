import { toast } from 'svelte-sonner';

/**
 * Wrapper around fetch that handles 401 Unauthorized responses
 * by showing a toast, redirecting to /signin, and storing the current URL for redirect after login
 */
export async function apiFetch(
	url: string,
	options?: RequestInit
): Promise<Response> {
	const response = await fetch(url, options);

	// If 401 Unauthorized, show toast, store current URL and redirect to signin
	if (response.status === 401) {
		// Show toast message
		toast.error('Log in before adding to cart');
		
		// Store the current page URL so we can redirect back after login
		const currentUrl = window.location.pathname + window.location.search;
		sessionStorage.setItem('redirectAfterLogin', currentUrl);
		window.location.href = '/signin';
		throw new Error('Unauthorized');
	}

	return response;
}

