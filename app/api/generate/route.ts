import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getBookForUser,
  getChapters,
  createChapter,
  completeChapter,
  setBookStatus,
  createVersion,
} from "@/lib/db/queries";
import {
  createChapterStream,
  createContinueStream,
  friendlyAiError,
} from "@/lib/ai/claude";
import { bookContextText } from "@/lib/ai/prompts";
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";
import { textToDoc, wordCount } from "@/lib/tiptap";
import { summarizeChapter, indexChapter } from "@/lib/ai/rag";
import { normalize } from "@/lib/text/normalizer";
import { getLayoutProfile } from "@/lib/layout/profile";
import { buildAnchoredContext } from "@/lib/generate/context";
import { stripMarkers, persistExtraction } from "@/lib/generate/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const {
    bookId,
    mode,
    context,
    index: reqIndex,
    chapterId: reqChapterId,
    fullText: reqFullText,
  } = await request.json().catch(() => ({}));
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
  const profile = getLayoutProfile(book.layoutProfileId, book.type);
  const briefText = bookContextText({
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
  const encoder = new TextEncoder();
  const sseHeaders = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };

  /* ---------- Modo: continuar o capítulo atual ---------- */
  if (mode === "continue") {
    // Cauda REAL do capítulo atual (só ela emenda a continuação) — NUNCA RAG.
    const ctx = typeof context === "string" ? context.slice(-1800) : "";
    const existingForCtx = await getChapters(bookId);
    const curIndex =
      typeof reqIndex === "number" && reqIndex > 0
        ? reqIndex
        : Math.max(1, existingForCtx.length);
    // Contexto Ancorado = estado da história (cânone/timeline/conhecimento/
    // resumo rolante/beat) para AVANÇAR a trama, não repeti-la.
    const { briefText: anchoredBrief } = await buildAnchoredContext(
      bookId,
      book,
      curIndex,
      existingForCtx
    );
    const stream = createContinueStream({
      briefText: anchoredBrief,
      context: ctx,
      index: curIndex,
    });
    if (!stream) {
      return NextResponse.json(
        { error: "IA não configurada (defina ANTHROPIC_API_KEY)." },
        { status: 503 }
      );
    }

    // Capítulo-alvo (para persistir/alimentar o motor de consistência).
    const targetChapter =
      typeof reqChapterId === "string"
        ? existingForCtx.find((c) => c.id === reqChapterId)
        : existingForCtx.find((c) => c.index === curIndex);
    const baseFull =
      typeof reqFullText === "string" && reqFullText.trim()
        ? reqFullText.trim()
        : (targetChapter?.contentText ?? "");

    const body = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        let added = "";
        try {
          stream.on("text", (delta: string) => {
            added += delta;
            send({ type: "delta", text: delta });
          });
          const finalMsg = await stream.finalMessage();
          const credits = creditsForUsage({
            tokensIn: finalMsg.usage.input_tokens,
            tokensOut: finalMsg.usage.output_tokens,
          });
          try {
            await debitCredits(userId, credits, "continuar capítulo");
          } catch {}

          // Concatena ao conteúdo anterior e alimenta o motor de consistência
          // (mesmo pipeline da geração completa), se houver capítulo-alvo.
          let normalized: string | null = null;
          if (targetChapter && added.trim()) {
            const complete = baseFull ? `${baseFull}\n\n${added}` : added;
            const { clean, novoFatos, lacunas } = stripMarkers(complete);
            normalized = normalize(clean, profile);
            const summary = await summarizeChapter(normalized);
            await completeChapter(targetChapter.id, {
              contentJson: textToDoc(normalized),
              contentText: normalized,
              tokensUsed: finalMsg.usage.output_tokens,
              summary,
            });
            try {
              await indexChapter(bookId, targetChapter.id, normalized);
            } catch {}
            try {
              await createVersion(
                bookId,
                targetChapter.id,
                `Continuação: ${targetChapter.title ?? `Capítulo ${curIndex}`}`,
                { contentText: normalized, contentJson: textToDoc(normalized) }
              );
            } catch {}
            try {
              await persistExtraction({
                bookId,
                index: curIndex,
                cleanText: normalized,
                bookContext: briefText,
                novoFatos,
                lacunas,
                chapterSummary: summary,
              });
            } catch {}
          }

          // Meta de páginas (considera o capítulo recém-atualizado).
          const target = (book.pageTarget ?? 0) * 280;
          const totalWords = existingForCtx.reduce(
            (acc, c) =>
              acc +
              wordCount(
                c.id === targetChapter?.id && normalized
                  ? normalized
                  : c.contentText ?? ""
              ),
            0
          );
          const targetReached = target > 0 && totalWords >= target;
          if (targetReached) {
            try {
              await setBookStatus(bookId, userId, "review");
            } catch {}
          }

          send({
            type: "done",
            debited: credits,
            balance: balance - credits,
            chapterId: targetChapter?.id,
            contentText: normalized ?? undefined,
            totalWords,
            target,
            targetReached,
          });
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
  // Laço preventivo: Contexto Ancorado (cânone/estado/timeline/conhecimento/
  // fios determinísticos + RAG) em vez do resumo rolante simples.
  const { briefText: anchoredBrief, prevContext } = await buildAnchoredContext(
    bookId,
    book,
    index,
    existing
  );

  const stream = createChapterStream({
    briefText: anchoredBrief,
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

        // Motor de consistência: remove [NOVO_FATO]/[LACUNA] (capturando-os);
        // Camada A: normaliza tipograficamente antes de persistir (o stream ao
        // cliente foi cru, para o efeito de digitação; o salvo é o limpo).
        const { clean, novoFatos, lacunas } = stripMarkers(fullText);
        const normalized = normalize(clean, profile);

        const summary = await summarizeChapter(normalized);
        await completeChapter(chapter.id, {
          contentJson: textToDoc(normalized),
          contentText: normalized,
          tokensUsed: usage.output_tokens,
          summary,
        });
        try {
          await indexChapter(bookId, chapter.id, normalized);
        } catch {}
        try {
          await createVersion(bookId, chapter.id, `Gerado: ${chapter.title}`, {
            contentText: normalized,
            contentJson: textToDoc(normalized),
          });
        } catch {}
        // Atualização de estado (extração síncrona, Haiku): ledgers + snapshot.
        try {
          await persistExtraction({
            bookId,
            index,
            cleanText: normalized,
            bookContext: briefText,
            novoFatos,
            lacunas,
            chapterSummary: summary,
          });
        } catch {}
        try {
          await debitCredits(userId, credits, "geração de capítulo", chapter.id);
        } catch {}

        const totalWords = priorWords + wordCount(normalized);
        const targetReached = target > 0 && totalWords >= target;
        if (targetReached) await setBookStatus(bookId, userId, "review");

        send({
          type: "done",
          chapterId: chapter.id,
          index,
          title: chapter.title,
          words: wordCount(normalized),
          contentText: normalized,
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
