import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getBookForUser, upsertCover, type CoverData } from "@/lib/db/queries";
import { generateImage, hasKie } from "@/lib/ai/kie";
import {
  creditErrorResponse,
  startMetered,
  type MeteredOp,
} from "@/lib/ai/with-credits";
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

  // Reserva antes de chamar o provedor; qualquer falha abaixo estorna tudo.
  let metered: MeteredOp;
  try {
    metered = await startMetered(session.user.id, "cover_art");
  } catch (err) {
    const res = creditErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const side: "front" | "back" = which === "back" ? "back" : "front";
  // IMPORTANTE: NÃO mencionar "capa de livro"/"título" — isso faz o modelo
  // desenhar texto. Descrever apenas como ilustração/cena vertical.
  const fullPrompt =
    `Ilustração vertical, puramente visual, sem qualquer texto. ${prompt}. ` +
    `${style ? `Estilo: ${style}. ` : ""}` +
    `${palette ? `Paleta de cores: ${palette}. ` : ""}` +
    `Cena artística limpa, com áreas de respiro (céu, parede, névoa, sombra). ` +
    `Proibido: qualquer palavra, letra, número, título, legenda, assinatura ou ` +
    `tipografia. Apenas imagem.`;

  // Capa = retrato; estilo REALISTIC quando o pedido for fotográfico.
  const realistic = /foto|fotogr|photo|realis|cinemat/i.test(`${style} ${prompt}`);
  let url: string;
  try {
    url = await generateImage(fullPrompt.slice(0, 900), {
      imageSize: "portrait_4_3",
      style: realistic ? "REALISTIC" : "DESIGN",
    });
    metered.meter.recordImages(1);
  } catch (e) {
    await metered.refund();
    const detail = e instanceof Error ? e.message : String(e);
    console.error("cover art error:", detail);
    return NextResponse.json(
      { error: `Não foi possível gerar a arte. (${detail})` },
      { status: 502 }
    );
  }

  let stored: string;
  try {
    stored = await persistFromUrl(`covers/${bookId}/${side}`, url);
    const artField =
      side === "front" ? { frontArtUrl: stored } : { backArtUrl: stored };
    await upsertCover(bookId, {
      ...artField,
      artPrompt: prompt,
      style: style || null,
      palette: palette ? { description: palette } : null,
    } as Partial<CoverData>);
  } catch (err) {
    await metered.refund();
    throw err;
  }

  const { balance } = await metered.settle();
  return NextResponse.json({ url: stored, balance });
}
