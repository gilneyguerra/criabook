import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getBookForUser, upsertCover, type CoverData } from "@/lib/db/queries";
import { generateImage, hasKie } from "@/lib/ai/kie";
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";
import { persistFromUrl } from "@/lib/storage/blob";

// Geração de arte é lenta (modelo de imagem) — precisa da janela de 60s, igual
// ao /api/images. Em server action o tempo era cortado e a arte "falhava".
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!hasKie()) {
    return NextResponse.json(
      { error: "Geração de imagem não configurada (defina KIE_AI_API_KEY)." },
      { status: 503 }
    );
  }

  const { bookId, prompt, style, palette, which } = await request
    .json()
    .catch(() => ({}));
  const book = await getBookForUser(String(bookId), session.user.id).catch(
    () => null
  );
  if (!book) {
    return NextResponse.json({ error: "Livro não encontrado." }, { status: 404 });
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json(
      { error: "Descreva a imagem principal." },
      { status: 400 }
    );
  }

  const cost = creditsForUsage({ images: 1 });
  const balance = await getBalance(session.user.id);
  if (balance < cost) {
    return NextResponse.json({ error: "Créditos insuficientes." }, { status: 402 });
  }

  const side: "front" | "back" = which === "back" ? "back" : "front";
  const fullPrompt =
    `Capa de livro de ${book.genre ?? "ficção"}. ${prompt}. ` +
    `${style ? `Estilo: ${style}. ` : ""}` +
    `${palette ? `Paleta: ${palette}. ` : ""}` +
    `Composição vertical para capa, espaço para o título. ` +
    `IMPORTANTE: NÃO inclua nenhum texto, letra, número ou tipografia na imagem.`;

  let url: string;
  try {
    url = await generateImage(fullPrompt.slice(0, 900));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("cover art error:", detail);
    return NextResponse.json(
      { error: `Não foi possível gerar a arte. (${detail})` },
      { status: 502 }
    );
  }

  const stored = await persistFromUrl(`covers/${bookId}/${side}`, url);

  const artField =
    side === "front" ? { frontArtUrl: stored } : { backArtUrl: stored };
  await upsertCover(bookId, {
    ...artField,
    artPrompt: prompt,
    style: style || null,
    palette: palette ? { description: palette } : null,
  } as Partial<CoverData>);

  try {
    await debitCredits(session.user.id, cost, "arte da capa");
  } catch {}

  return NextResponse.json({ url: stored, balance: balance - cost });
}
