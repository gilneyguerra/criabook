import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  getChapters,
  addChapterImage,
} from "@/lib/db/queries";
import { generateImage, hasKie, KIE_MODEL } from "@/lib/ai/kie";
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";

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

  const cost = creditsForUsage({ images: 1 });
  const balance = await getBalance(session.user.id);
  if (balance < cost) {
    return NextResponse.json({ error: "Créditos insuficientes." }, { status: 402 });
  }

  const base =
    typeof prompt === "string" && prompt.trim()
      ? prompt.trim().slice(0, 600)
      : chapter.summary ?? (chapter.contentText ?? "").slice(0, 400);

  const fullPrompt = `${base}. Ilustração editorial para livro de ${book.genre ?? "ficção"}, tom ${book.tone ?? "neutro"}; sem texto na imagem.`;

  let url: string | null = null;
  try {
    url = await generateImage(fullPrompt);
  } catch {
    url = null;
  }
  if (!url) {
    return NextResponse.json(
      { error: "Não foi possível gerar a imagem agora. Tente novamente." },
      { status: 502 }
    );
  }

  await addChapterImage(chapter.id, {
    storagePath: url,
    prompt: fullPrompt,
    model: KIE_MODEL,
  });
  try {
    await debitCredits(session.user.id, cost, "geração de imagem");
  } catch {}

  return NextResponse.json({ url, balance: balance - cost });
}
