<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
	} from "$lib/components/ui/field/index.js";
	import * as InputOTP from "$lib/components/ui/input-otp/index.js";
	import { toast } from "svelte-sonner";
	import { goto } from "$app/navigation";

	const id = $props.id();

	let email = $state("");
	let otp = $state("");
	let showOTP = $state(false);
	let requestingOTP = $state(false);
	let verifyingOTP = $state(false);

	async function handleEmailSubmit(e: SubmitEvent) {
		e.preventDefault();
		
		if (!email.trim()) {
			toast.error("Please enter your email");
			return;
		}

		requestingOTP = true;
		try {
			const res = await fetch("/api/consumer/otp/request", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.trim() }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to send OTP");
			}

			toast.success("OTP sent to your email");
			showOTP = true;
		} catch (err) {
			console.error(err);
			if (err instanceof Error) {
				toast.error(err.message);
			} else {
				toast.error("Failed to send OTP");
			}
		} finally {
			requestingOTP = false;
		}
	}

	async function handleOTPSubmit(e: SubmitEvent) {
		e.preventDefault();
		
		if (otp.length !== 6) {
			toast.error("Please enter a valid 6-digit OTP");
			return;
		}

		verifyingOTP = true;
		try {
			const res = await fetch("/api/consumer/otp/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.trim(), otp: otp }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Invalid OTP");
			}

			toast.success("Login successful!");
			
			// Check if there's a redirect URL stored
			const redirectUrl = sessionStorage.getItem("redirectAfterLogin");
			if (redirectUrl) {
				sessionStorage.removeItem("redirectAfterLogin");
				goto(redirectUrl);
			} else {
				goto("/");
			}
		} catch (err) {
			console.error(err);
			if (err instanceof Error) {
				toast.error(err.message);
			} else {
				toast.error("Failed to verify OTP");
			}
		} finally {
			verifyingOTP = false;
		}
	}

	function handleOTPChange(value: string) {
		// Auto-submit when 6 digits are entered
		if (value.length === 6) {
			const form = document.querySelector("form[data-otp-form]") as HTMLFormElement;
			if (form) {
				form.requestSubmit();
			}
		}
	}
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Login</Card.Title>
		<Card.Description>
			{showOTP ? "Enter the OTP sent to your email" : "Enter your email below to login to your account"}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if !showOTP}
			<form onsubmit={handleEmailSubmit}>
				<FieldGroup>
					<Field>
						<FieldLabel for="email-{id}">Email</FieldLabel>
						<Input 
							id="email-{id}" 
							type="email" 
							placeholder="m@example.com" 
							bind:value={email}
							required 
							disabled={requestingOTP}
						/>
					</Field>
					<Field>
						<Button type="submit" class="w-full" disabled={requestingOTP}>
							{requestingOTP ? "Sending OTP..." : "Sign in"}
						</Button>
						<Button variant="outline" class="w-full" href="/api/auth/google">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
								<path
									d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
									fill="currentColor"
								/>
							</svg>
							Login with Google
						</Button>
						<FieldDescription class="text-center">
							Don't have an account? <a href="##">Sign up</a>
						</FieldDescription>
					</Field>
				</FieldGroup>
			</form>
		{:else}
			<form onsubmit={handleOTPSubmit} data-otp-form>
				<FieldGroup>
					<Field>
						<FieldLabel>Enter OTP</FieldLabel>
						<div class="flex justify-center">
							<InputOTP.Root maxlength={6} bind:value={otp} onValueChange={handleOTPChange} disabled={verifyingOTP}>
								{#snippet children({ cells })}
									<InputOTP.Group>
										{#each cells.slice(0, 3) as cell}
											<InputOTP.Slot {cell} />
										{/each}
									</InputOTP.Group>
									<InputOTP.Separator />
									<InputOTP.Group>
										{#each cells.slice(3, 6) as cell}
											<InputOTP.Slot {cell} />
										{/each}
									</InputOTP.Group>
								{/snippet}
							</InputOTP.Root>
						</div>
					</Field>
					<Field>
						<Button type="submit" class="w-full" disabled={verifyingOTP || otp.length !== 6}>
							{verifyingOTP ? "Verifying..." : "Verify OTP"}
						</Button>
						<Button 
							type="button" 
							variant="outline" 
							class="w-full" 
							onclick={() => { showOTP = false; otp = ""; }}
							disabled={verifyingOTP}
						>
							Change Email
						</Button>
					</Field>
				</FieldGroup>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
