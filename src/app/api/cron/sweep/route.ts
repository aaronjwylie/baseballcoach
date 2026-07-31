import { NextResponse } from "next/server";
import { env } from "@/shared/config/env";
import { runRetentionSweep } from "@/domains/upload";

/**
 * The nightly retention sweep, driven by Vercel Cron (`vercel.json`).
 *
 * Guarded by `CRON_SECRET`, which Vercel sends as `Authorization: Bearer …` on
 * its own invocations. Without the guard this is a public endpoint that deletes
 * customer files, so a **missing secret refuses rather than allows** — the one
 * place in the app where absent config must not degrade gracefully.
 *
 * `maxDuration` is raised because the work is proportional to how many
 * submissions came due, and each file is a round trip to Blob.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!env.cronSecret) {
    console.error("[cron/sweep] CRON_SECRET is unset — refusing to run.");
    return new Response("Not configured", { status: 503 });
  }

  const provided = request.headers.get("authorization");
  if (provided !== `Bearer ${env.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const report = await runRetentionSweep();
    console.log(JSON.stringify({ event: "retention_sweep", ...report }));
    return NextResponse.json(report);
  } catch (err) {
    console.error("[cron/sweep] failed:", err);
    return NextResponse.json({ error: "Sweep failed." }, { status: 500 });
  }
}
