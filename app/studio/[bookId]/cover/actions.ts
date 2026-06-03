"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  upsertCover,
  getChapters,
  getBible,
  getBookMeta,
  saveBookMatter,
  type CoverData,
} from "@/lib/db/queries";
import { bookContextText } from "@/lib/ai/prompts";
import { generateImage, hasKie } from "@/lib/ai/kie";
import { generateCoverText, generateSocialProof } from "@/lib/ai/claude";
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";
import { persistFromUrl } from "@/lib/storage/blob";
import type { Matter } from "@/lib/matter";

type BookRow = NonNullable<Awaited<ReturnType<typeof getBookForUser>>>;

/** Contexto para os textos comerciais: Base + amostra do livro + nomes da Bíblia. */
async function coverContext(bookId: string, book: BookRow, withBody: boolean) {
  const base = bookContextText({
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
  const [bible, chapters] = await Promise.all([
    getBible(bookId).catch(() => null),
    withBody ? getChapters(bookId).catch(() => []) : Promise.resolve([]),
  ]);
  const names = bible
    ? [
        bible.characters.map((c) => c.name).join(", "),
        bible.locations.map((l) => l.name).join(", "),
      ]
        .filter(Boolean)
        .join(" | ")
    : "";
  const body = chapters.length
    ? "\n\nResumo do livro:\n" +
      chapters
        .map((c) => `Cap ${c.index}: ${c.summary ?? (c.contentText ?? "").slice(0, 200)}`)
        .filter(Boolean)
        .join("\n")
        .slice(0, 6000)
    : "";
  return `${base}${names ? `\nNomes (use exatamente): ${names}` : ""}${body}`;
}

/** Salva campos da capa; sincroniza autor/bio com a aba Páginas. */
export async function saveCover(
  bookId: string,
  data: Partial<Omit<CoverData, "id" | "bookId">>
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  await upsertCover(bookId, data);

  // Sync com Páginas (front/back matter): autor e "Sobre o autor" ↔ bio.
  if (data.authorName !== undefined || data.flapBio !== undefined) {
    const meta = await getBookMeta(bookId).catch(() => null);
    const matter = { ...((meta?.matter ?? {}) as Matter) };
    if (data.authorName !== undefined && data.authorName)
      matter.authorName = data.authorName;
    if (data.flapBio !== undefined && data.flapBio)
      matter.aboutAuthor = data.flapBio;
    await saveBookMatter(bookId, matter).catch(() => {});
  }
  return { ok: true };
}

/** Gera a arte (Camada 1) via Kie.ai e rehospeda no Blob. */
export async function generateCoverArt(
  bookId: string,
  opts: { prompt: string; style?: string; palette?: string; which?: "front" | "back" }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  if (!hasKie())
    return { error: "Geração de imagem não configurada (defina KIE_AI_API_KEY)." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const cost = creditsForUsage({ images: 1 });
  const balance = await getBalance(session.user.id);
  if (balance < cost) return { error: "Créditos insuficientes." };

  const which = opts.which ?? "front";
  const fullPrompt =
    `Capa de livro de ${book.genre ?? "ficção"}. ${opts.prompt}. ` +
    `${opts.style ? `Estilo: ${opts.style}. ` : ""}` +
    `${opts.palette ? `Paleta: ${opts.palette}. ` : ""}` +
    `Composição vertical para capa, espaço para o título. ` +
    `IMPORTANTE: NÃO inclua nenhum texto, letra, número ou tipografia na imagem.`;

  let url: string | null = null;
  try {
    url = await generateImage(fullPrompt.slice(0, 900));
  } catch {
    url = null;
  }
  if (!url) return { error: "Não foi possível gerar a arte agora. Tente novamente." };

  const stored = await persistFromUrl(`covers/${bookId}/${which}`, url);

  const artField =
    which === "front" ? { frontArtUrl: stored } : { backArtUrl: stored };
  await upsertCover(bookId, {
    ...artField,
    artPrompt: opts.prompt,
    style: opts.style ?? null,
    palette: opts.palette ? { description: opts.palette } : null,
  });

  try {
    await debitCredits(session.user.id, cost, "arte da capa");
  } catch {}

  return { ok: true, url: stored, balance: balance - cost };
}

/** Gera um texto comercial (4ª capa / orelha / bio / prova social). */
export async function generateCoverTextAction(
  bookId: string,
  kind: "back" | "flapFront" | "bio" | "social"
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };

  const estimate = creditsForUsage({ tokensIn: 2000, tokensOut: 1000 });
  const balance = await getBalance(session.user.id);
  if (balance < estimate) return { error: "Créditos insuficientes." };

  let ctx = await coverContext(bookId, book, kind !== "bio");
  if (kind === "bio") {
    const meta = await getBookMeta(bookId).catch(() => null);
    const prev = ((meta?.matter ?? {}) as Matter).aboutAuthor;
    if (prev) ctx += `\n\nBio atual (refine): ${prev}`;
  }

  try {
    if (kind === "social") {
      const items = await generateSocialProof(ctx);
      if (!items.length) return { error: "Não foi possível gerar agora." };
      await debitCredits(session.user.id, estimate, "texto da capa").catch(() => {});
      return { ok: true, social: items };
    }
    const text = await generateCoverText(kind, ctx);
    if (!text) return { error: "Não foi possível gerar agora." };
    await debitCredits(session.user.id, estimate, "texto da capa").catch(() => {});
    return { ok: true, text };
  } catch {
    return { error: "Falha ao gerar o texto. Tente novamente." };
  }
}
