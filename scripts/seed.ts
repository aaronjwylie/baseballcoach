/**
 * Seed the first operator.
 *
 * The portal has no public signup — the initial admin (Yuta) is created here,
 * and every coach is added later from inside the admin portal. Idempotent:
 * re-running when the admin already exists is a no-op.
 *
 * Credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD, with dev
 * defaults so a fresh checkout can log in immediately.
 */
import "./loadEnv";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "@/shared/db";

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "yuta@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[seed] admin ${email} already exists — nothing to do`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ email, passwordHash, role: "admin" });

  console.log(`[seed] created admin ${email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(
      `[seed] default password is "${password}" — change it after first login`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
