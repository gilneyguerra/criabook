import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  getChapters,
  createChapter,
  completeChapter,
  setBookStatus,
} from "@/lib/db/queries";
import { createChapterStream } from "@/lib/ai/claude";
import { briefToText } from "@/lib/ai/prompts";
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";
import { textToDoc, wordCount } from "@/lib/tiptap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { bookId } = await request.json().catch(() => ({}));
  const book = await getBookForUser(String(bookId), session.user.id).catch(
    () => null
  );
  if (!book) {
    return NextResponse.json({ error: "Livro não encontrado." }, { status: 404 });
  }

  // Pré-checagem de créditos (estimativa de um capítulo).
  const estimate = creditsForUsage({ tokensIn: 1500, tokensOut: 3500 });
  const balance = await getBalance(session.user.id);
  if (balance < estimate) {
    return NextResponse.json(
      { error: "Créditos insuficientes para gerar um capítulo." },
      { status: 402 }
    );
  }

  const existing = await getChapters(bookId);
  const index = existing.length + 1;
  const prev = existing[existing.length - 1]?.contentText ?? "";
  const prevContext = prev ? prev.slice(0, 1500) : undefined;

  const stream = createChapterStream({
    briefText: briefToText(book.brief as Record<string, string[]>, book.title),
    index,
    prevContext,
  });
  if (!stream) {
    return NextResponse.json(
      { error: "IA não configurada (defina ANTHROPIC_API_KEY)." },
      { status: 503 }
    );
  }

  const chapter = await createChapter(bookId, index, `Capítulo ${index}`);
  const userId = session.user.id;
  const priorWords = existing.reduce(
    (acc, c) => acc + wordCount(c.contentText ?? ""),
    0
  );
  const target = (book.pageTarget ?? 0) * 280;

  const encoder = new TextEncoder();
  let fullText = "";

  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        stream.on("text", (delta: string) => {
          fullText += delta;
          send({ type: "delta", text: delta });
        });

        const finalMsg = await stream.finalMessage();
        const usage = finalMsg.usage;
        const credits = creditsForUsage({
          tokensIn: usage.input_tokens,
          tokensOut: usage.output_tokens,
        });

        await debitCredits(userId, credits, "geração de capítulo", chapter.id);
        await completeChapter(chapter.id, {
          contentJson: textToDoc(fullText),
          contentText: fullText,
          tokensUsed: usage.output_tokens,
        });

        const totalWords = priorWords + wordCount(fullText);
        const targetReached = target > 0 && totalWords >= target;
        if (targetReached) {
          await setBookStatus(bookId, userId, "review");
        }

        send({
          type: "done",
          chapterId: chapter.id,
          index,
          title: chapter.title,
          words: wordCount(fullText),
          totalWords,
          target,
          targetReached,
          debited: credits,
          balance: balance - credits,
        });
        controller.close();
      } catch {
        send({ type: "error", message: "Falha na geração do capítulo." });
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
