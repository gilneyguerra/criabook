import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  getChapters,
  addChapterImage,
} from "@/lib/db/queries";
import { generateImage, hasKie, KIE_MODEL } from "@/lib/ai/kie";
import {
  creditErrorResponse,
  startMetered,
  type MeteredOp,
} from "@/lib/ai/with-credits";
import { persistFromUrl } from "@/lib/storage/blob";

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

  const { bookId, chapterId, prompt } = await request.json().catch(() => ({}));
  const book = await getBookForUser(String(bookId), session.user.id).catch(
    () => null
  );
  if (!book) {
    return NextResponse.json({ error: "Livro não encontrado." }, { status: 404 });
  }

  const chapters = await getChapters(bookId);
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) {
    return NextResponse.json({ error: "Capítulo não encontrado." }, { status: 404 });
  }

  const base =
    typeof prompt === "string" && prompt.trim()
      ? prompt.trim().slice(0, 600)
      : chapter.summary ?? (chapter.contentText ?? "").slice(0, 400);

  const fullPrompt = `${base}. Ilustração editorial para livro de ${book.genre ?? "ficção"}, tom ${book.tone ?? "neutro"}; sem texto na imagem.`;

  // Reserva antes de chamar o provedor; qualquer falha abaixo estorna tudo.
  let metered: MeteredOp;
  try {
    metered = await startMetered(session.user.id, "image");
  } catch (err) {
    const res = creditErrorResponse(err);
    if (res) return res;
    throw err;
  }

  let url: string;
  try {
    url = await generateImage(fullPrompt);
    metered.meter.recordImages(1);
  } catch (e) {
    await metered.refund();
    const detail = e instanceof Error ? e.message : String(e);
    console.error("ilustrar error:", detail);
    return NextResponse.json(
      { error: `Não foi possível gerar a imagem. (${detail})` },
      { status: 502 }
    );
  }

  let stored: string;
  try {
    // Rehospeda no Blob (URLs da Kie expiram ~14 dias); a imagem fica inline no texto.
    stored = await persistFromUrl(`chapters/${bookId}/${chapter.id}-${Date.now()}`, url);
    await addChapterImage(chapter.id, {
      storagePath: stored,
      prompt: fullPrompt,
      model: KIE_MODEL,
    });
  } catch (err) {
    await metered.refund();
    throw err;
  }

  const { balance } = await metered.settle();
  return NextResponse.json({ url: stored, balance });
}
