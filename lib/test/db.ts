import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { profiles, user } from "@/lib/db/schema";

/**
 * Testes com banco só rodam contra um banco descartável: o Postgres local do
 * CI (via proxy em `db.localtest.me`) ou uma branch do Neon marcada com
 * ALLOW_DB_TESTS=1. Nunca contra produção.
 */
export const hasTestDb =
  (process.env.DATABASE_URL ?? "").includes("@db.localtest.me") ||
  process.env.ALLOW_DB_TESTS === "1";

export type TestUser = { id: string; email: string };

export async function createTestUser(
  opts: { credits?: number } = {}
): Promise<TestUser> {
  const id = `test_${randomUUID()}`;
  const email = `${id}@test.criabook.local`;
  await db.insert(user).values({ id, name: "Teste", email });
  await db
    .insert(profiles)
    .values({ id, creditsBalance: opts.credits ?? 0 });
  return { id, email };
}

/** Apaga o usuário (o resto cai em cascata). */
export async function deleteTestUser(id: string): Promise<void> {
  await db.delete(user).where(eq(user.id, id));
}
