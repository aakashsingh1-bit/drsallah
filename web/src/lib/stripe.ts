import { loadStripe, type Stripe } from "@stripe/stripe-js";

const key = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)?.trim();

export const stripePromise: Promise<Stripe | null> =
  key && isStripeConfigured() ? loadStripe(key) : Promise.resolve(null);

export function isStripeConfigured() {
  if (!key) return false;
  if (key.includes("your_stripe") || key.includes("placeholder")) return false;
  return key.startsWith("pk_test_") || key.startsWith("pk_live_");
}
