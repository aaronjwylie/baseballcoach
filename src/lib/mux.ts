import Mux from "@mux/mux-node";
import { env } from "./env";

let client: Mux | null = null;

export function mux(): Mux {
  if (!client) {
    client = new Mux({
      tokenId: env.muxTokenId,
      tokenSecret: env.muxTokenSecret,
      webhookSecret: env.muxWebhookSecret,
    });
  }
  return client;
}
