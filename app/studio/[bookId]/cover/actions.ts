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
import {
  generateCoverText,
  generateSocialProof,
  suggestCoverArt,
  suggestComplementaryArt,
  suggestCoverStyle,
} from "@/lib/ai/claude";
import { creditedAction } from "@/lib/ai/with-credits";
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

/** Sugere a direção de arte da Camada 1 (preenche "imagem principal"). */
export async function suggestArtAction(bookId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };
  const ctx = await coverContext(bookId, book, false);
  const r = await creditedAction(session.user.id, "suggest", () => suggestCoverArt(ctx), {
    empty: "Não foi possível sugerir agora.",
  });
  if ("error" in r) return { error: r.error, code: r.code };
  return { ok: true, text: r.value };
}

/** Sugere estilo/paleta/cores da capa a partir do livro. */
export async function suggestStyleAction(bookId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };
  const ctx = await coverContext(bookId, book, false);
  const r = await creditedAction(session.user.id, "suggest", () => suggestCoverStyle(ctx), {
    empty: "Não foi possível sugerir agora.",
  });
  if ("error" in r) return { error: r.error, code: r.code };
  return { ok: true, ...r.value };
}

/** Sugere a cena da CONTRA CAPA que complementa a capa frontal. */
export async function suggestBackArtAction(
  bookId: string,
  frontPrompt: string,
  style: string,
  palette: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) return { error: "Livro não encontrado." };
  if (!frontPrompt.trim())
    return { error: "Defina a imagem da capa primeiro." };
  const r = await creditedAction(
    session.user.id,
    "suggest",
    () =>
      suggestComplementaryArt(
        frontPrompt.slice(0, 2000),
        style.slice(0, 300),
        palette.slice(0, 300)
      ),
    { empty: "Não foi possível sugerir agora." }
  );
  if ("error" in r) return { error: r.error, code: r.code };
  return { ok: true, text: r.value };
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

  let ctx = await coverContext(bookId, book, kind !== "bio");
  if (kind === "bio") {
    const meta = await getBookMeta(bookId).catch(() => null);
    const prev = ((meta?.matter ?? {}) as Matter).aboutAuthor;
    if (prev) ctx += `\n\nBio atual (refine): ${prev}`;
  }

  const messages = {
    empty: "Não foi possível gerar agora.",
    failure: "Falha ao gerar o texto. Tente novamente.",
  };
  if (kind === "social") {
    const r = await creditedAction(
      session.user.id,
      "cover_text",
      () => generateSocialProof(ctx),
      messages
    );
    if ("error" in r) return { error: r.error, code: r.code };
    return { ok: true, social: r.value };
  }
  const r = await creditedAction(
    session.user.id,
    "cover_text",
    () => generateCoverText(kind, ctx),
    messages
  );
  if ("error" in r) return { error: r.error, code: r.code };
  return { ok: true, text: r.value };
}
