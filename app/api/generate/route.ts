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
import {
  createChapterStream,
  createContinueStream,
  friendlyAiError,
} from "@/lib/ai/claude";
import { briefToText } from "@/lib/ai/prompts";
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";
import { textToDoc, wordCount } from "@/lib/tiptap";
import { retrieveContext, summarizeChapter, indexChapter } from "@/lib/ai/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { bookId, mode, context } = await request.json().catch(() => ({}));
  const book = await getBookForUser(String(bookId), session.user.id).catch(
    () => null
  );
  if (!book) {
    return NextResponse.json({ error: "Livro não encontrado." }, { status: 404 });
  }

  const estimate = creditsForUsage({ tokensIn: 1500, tokensOut: 3500 });
  const balance = await getBalance(session.user.id);
  if (balance < estimate) {
    return NextResponse.json(
      { error: "Créditos insuficientes para gerar." },
      { status: 402 }
    );
  }

  const userId = session.user.id;
  const briefText = briefToText(
    book.brief as Record<string, string[]>,
    book.title
  );
  const encoder = new TextEncoder();
  const sseHeaders = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };

  /* ---------- Modo: continuar o capítulo atual ---------- */
  if (mode === "continue") {
    const ctx = typeof context === "string" ? context.slice(-3000) : "";
    const retrieved = await retrieveContext(bookId, ctx || briefText, 4);
    const fullCtx = [
      retrieved.length ? `Trechos relevantes:\n${retrieved.join("\n---\n")}` : "",
      ctx,
    ]
      .filter(Boolean)
      .join("\n\n");
    const stream = createContinueStream({ briefText, context: fullCtx });
    if (!stream) {
      return NextResponse.json(
        { error: "IA não configurada (defina ANTHROPIC_API_KEY)." },
        { status: 503 }
      );
    }

    const body = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          stream.on("text", (delta: string) => send({ type: "delta", text: delta }));
          const finalMsg = await stream.finalMessage();
          const credits = creditsForUsage({
            tokensIn: finalMsg.usage.input_tokens,
            tokensOut: finalMsg.usage.output_tokens,
          });
          try {
            await debitCredits(userId, credits, "continuar capítulo");
          } catch {}
          send({ type: "done", debited: credits, balance: balance - credits });
          controller.close();
        } catch (err) {
          console.error("continue error", err);
          send({ type: "error", message: friendlyAiError(err) });
          controller.close();
        }
      },
    });
    return new Response(body, { headers: sseHeaders });
  }

  /* ---------- Modo: novo capítulo (padrão) ---------- */
  const existing = await getChapters(bookId);
  const index = existing.length + 1;
  // Contexto RAG: resumo rolante (resumos dos capítulos) + trechos recuperados.
  const rolling = existing
    .map((c) => c.summary ?? (c.contentText ?? "").slice(0, 200))
    .filter(Boolean)
    .join("\n");
  const retrieved = await retrieveContext(
    bookId,
    `${briefText}\nCapítulo ${index}`,
    5
  );
  const prevContext =
    [
      rolling && `Resumo da história até aqui:\n${rolling}`,
      retrieved.length &&
        `Trechos relevantes (capítulos/Bíblia):\n${retrieved.join("\n---\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n") || undefined;

  const stream = createChapterStream({ briefText, index, prevContext });
  if (!stream) {
    return NextResponse.json(
      { error: "IA não configurada (defina ANTHROPIC_API_KEY)." },
      { status: 503 }
    );
  }

  const chapter = await createChapter(bookId, index, `Capítulo ${index}`);
  const priorWords = existing.reduce(
    (acc, c) => acc + wordCount(c.contentText ?? ""),
    0
  );
  const target = (book.pageTarget ?? 0) * 280;
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

        const summary = await summarizeChapter(fullText);
        await completeChapter(chapter.id, {
          contentJson: textToDoc(fullText),
          contentText: fullText,
          tokensUsed: usage.output_tokens,
          summary,
        });
        try {
          await indexChapter(bookId, chapter.id, fullText);
        } catch {}
        try {
          await debitCredits(userId, credits, "geração de capítulo", chapter.id);
        } catch {}

        const totalWords = priorWords + wordCount(fullText);
        const targetReached = target > 0 && totalWords >= target;
        if (targetReached) await setBookStatus(bookId, userId, "review");

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
      } catch (err) {
        console.error("generate error", err);
        send({ type: "error", message: friendlyAiError(err) });
        controller.close();
      }
    },
  });

  return new Response(body, { headers: sseHeaders });
}
