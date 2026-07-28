import Stripe from "stripe";
import { env } from "@/shared/config/env";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(env.stripeSecretKey);
  }
  return client;
}
