/**
 * Seed the operators and some sample data for local dev.
 *
 * The portal has no public signup — the initial admin (Yuta) is created here,
 * plus one coach and a few submissions so the admin queue isn't empty on a
 * fresh checkout. Idempotent: re-running is a no-op once things exist.
 *
 * Admin/coach credentials come from env with dev defaults.
 */
import "./loadEnv";
import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { db, users, coaches, submissions } from "@/shared/db";
import { createSubmission } from "@/domains/submission";
import { storeVideo } from "@/domains/upload";

async function ensureUser(
  email: string,
  password: string,
  role: "admin" | "coach",
): Promise<{ id: string; created: boolean }> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };

  const passwordHash = await bcrypt.hash(password, 10);
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash, role })
    .returning({ id: users.id });
  return { id: row.id, created: true };
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "yuta@example.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "changeme123";
  const admin = await ensureUser(adminEmail, adminPassword, "admin");
  console.log(`[seed] admin ${adminEmail} ${admin.created ? "created" : "exists"}`);

  // The admin is always seeded. The sample coach + submissions are dev-only
  // fixtures — never pollute a production database with them.
  if (process.env.SEED_SAMPLES !== "1") {
    console.log("[seed] SEED_SAMPLES != 1 — admin only, skipping sample data");
    if (admin.created && !process.env.SEED_ADMIN_PASSWORD) {
      console.log(`[seed] default password is "${adminPassword}" — change it after first login`);
    }
    return;
  }

  const coachEmail = "coach@example.com";
  const coach = await ensureUser(coachEmail, "changeme123", "coach");
  if (coach.created) {
    await db.insert(coaches).values({
      userId: coach.id,
      name: "Coach Tanaka",
      specialties: ["Hitting", "Pitching"],
      languages: ["English", "Japanese"],
    });
  }
  console.log(`[seed] coach ${coachEmail} ${coach.created ? "created" : "exists"}`);

  const [{ n }] = await db.select({ n: count() }).from(submissions);
  if (n === 0) {
    await createSubmission({
      customerEmail: "parent1@example.com",
      playerName: "Alex Tanaka",
      playerAge: 14,
      focus: "Hitting",
      customerNotes: "Trying to fix an early bat drop on inside pitches.",
      status: "awaiting_upload",
      stripePaymentId: "pi_seed_1",
      stripeAmount: 14900,
    });

    // A "new" submission with a real placeholder file so the admin Download
    // link actually works end to end.
    const withVideo = await createSubmission({
      customerEmail: "parent2@example.com",
      playerName: "Sam Rivera",
      playerAge: 12,
      focus: "Pitching",
      status: "awaiting_upload",
      stripePaymentId: "pi_seed_2",
      stripeAmount: 14900,
    });
    await storeVideo(
      withVideo.id,
      "video.mp4",
      new TextEncoder().encode("seed placeholder video"),
      "video/mp4",
    );

    await createSubmission({
      customerEmail: "parent3@example.com",
      playerName: "Jordan Lee",
      playerAge: 16,
      focus: "Fielding",
      status: "complete",
      stripePaymentId: "pi_seed_3",
      stripeAmount: 14900,
    });

    console.log("[seed] created 3 sample submissions");
  } else {
    console.log(`[seed] ${n} submissions already present — skipping samples`);
  }

  if (admin.created && !process.env.SEED_ADMIN_PASSWORD) {
    console.log(`[seed] default password is "${adminPassword}" — change it after first login`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
