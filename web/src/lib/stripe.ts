import { loadStripe, type Stripe } from "@stripe/stripe-js";

const key = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)?.trim();

export const stripePromise: Promise<Stripe | null> =
  key && isStripeConfigured() ? loadStripe(key) : Promise.resolve(null);

export function isStripeConfigured() {
  if (!key) return false;
  const lower = key.toLowerCase();
  if (
    lower.includes("your_stripe") ||
    lower.includes("placeholder") ||
    lower.includes("your_key") ||
    lower.includes("changeme") ||
    lower.includes("xxx")
  ) {
    return false;
  }
  return (key.startsWith("pk_test_") || key.startsWith("pk_live_")) && key.length > 20;
}
