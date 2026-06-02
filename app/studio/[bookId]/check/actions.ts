"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getBookForUser, getChapters, getBible } from "@/lib/db/queries";
import { checkConsistency } from "@/lib/ai/claude";
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";

export async function runConsistencyCheck(bookId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const chapters = await getChapters(bookId);
  if (!chapters.length)
    return { error: "Gere pelo menos um capítulo antes de revisar." };

  const estimate = creditsForUsage({ tokensIn: 3000, tokensOut: 2000 });
  const balance = await getBalance(session.user.id);
  if (balance < estimate) return { error: "Créditos insuficientes." };

  const bible = await getBible(bookId).catch(() => null);

  const resumos = chapters
    .map(
      (c) =>
        `Cap ${c.index} — ${c.title ?? ""}: ${c.summary ?? (c.contentText ?? "").slice(0, 400)}`
    )
    .join("\n");

  const bibleText = bible
    ? [
        bible.characters.length &&
          "Personagens: " +
            bible.characters
              .map((c) => `${c.name} (${c.role ?? ""}) ${c.appearance ?? ""} ${c.traits ?? ""}`.trim())
              .join("; "),
        bible.locations.length &&
          "Locais: " + bible.locations.map((l) => l.name).join("; "),
        bible.worldRules.length &&
          "Regras: " + bible.worldRules.map((r) => r.rule).join("; "),
        bible.timeline.length &&
          "Linha do tempo: " + bible.timeline.map((t) => t.description).join("; "),
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const context = `RESUMOS DOS CAPÍTULOS:\n${resumos}\n\nBÍBLIA:\n${bibleText}`.slice(
    0,
    14000
  );

  let issues;
  try {
    issues = await checkConsistency(context);
  } catch {
    return { error: "Falha ao revisar. Tente novamente." };
  }
  try {
    await debitCredits(session.user.id, estimate, "verificação de consistência");
  } catch {}

  return { ok: true, issues };
}
