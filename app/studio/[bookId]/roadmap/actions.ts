"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  getStoryBeats,
  replaceStoryBeats,
  updateStoryBeat,
} from "@/lib/db/queries";
import { generateBeats } from "@/lib/ai/claude";
import { bookContextText } from "@/lib/ai/prompts";
import { getTemplate } from "@/lib/structure";
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";

export async function generateStructureAction(bookId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const estimate = creditsForUsage({ tokensIn: 1000, tokensOut: 2000 });
  const balance = await getBalance(session.user.id);
  if (balance < estimate) return { error: "Créditos insuficientes." };

  const template = getTemplate(book.structureMethod);
  const context = bookContextText({
    title: book.title,
    type: book.type,
    logline: book.logline,
    genre: book.genre,
    audience: book.audience,
    pov: book.pov,
    tone: book.tone,
    structureMethod: book.structureMethod,
    brief: book.brief as Record<string, string[]>,
  });

  let filled: { title: string; description: string }[] = [];
  try {
    filled = await generateBeats(
      context,
      template.map((t) => t.label)
    );
  } catch {
    return { error: "Falha ao gerar a estrutura." };
  }
  if (!filled.length) {
    return { error: "IA não configurada (defina ANTHROPIC_API_KEY)." };
  }

  const beats = template.map((t, i) => ({
    order: i,
    beatType: t.beatType,
    title: filled[i]?.title?.trim() || t.label,
    summary: filled[i]?.description?.trim() || "",
  }));

  await replaceStoryBeats(bookId, beats);
  try {
    await debitCredits(session.user.id, estimate, "gerar estrutura");
  } catch {}

  const saved = await getStoryBeats(bookId);
  return {
    ok: true,
    beats: saved.map((b) => ({
      id: b.id,
      order: b.order,
      title: b.title ?? "",
      summary: b.summary ?? "",
      beatType: b.beatType ?? "beat",
    })),
  };
}

export async function saveBeatAction(
  bookId: string,
  beatId: string,
  data: { title?: string; summary?: string }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  await updateStoryBeat(bookId, beatId, data);
  return { ok: true };
}
