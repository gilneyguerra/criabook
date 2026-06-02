import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { createHumanizeStream } from "@/lib/ai/claude";
import { getBalance, debitCredits, creditsForUsage } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { text } = await request.json().catch(() => ({}));
  const input = typeof text === "string" ? text.trim() : "";
  if (!input) {
    return NextResponse.json(
      { error: "Selecione um trecho para humanizar." },
      { status: 400 }
    );
  }

  // Estimativa grosseira de tokens do trecho (~4 chars/token) para pré-checagem.
  const estTokens = Math.ceil(input.length / 4);
  const estimate = creditsForUsage({
    tokensIn: estTokens,
    tokensOut: estTokens,
  });
  const balance = await getBalance(session.user.id);
  if (balance < estimate) {
    return NextResponse.json(
      { error: "Créditos insuficientes." },
      { status: 402 }
    );
  }

  const stream = createHumanizeStream({ text: input });
  if (!stream) {
    return NextResponse.json(
      { error: "IA não configurada (defina ANTHROPIC_API_KEY)." },
      { status: 503 }
    );
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        stream.on("text", (delta: string) => send({ type: "delta", text: delta }));
        const finalMsg = await stream.finalMessage();
        const usage = finalMsg.usage;
        const credits = creditsForUsage({
          tokensIn: usage.input_tokens,
          tokensOut: usage.output_tokens,
        });
        await debitCredits(userId, credits, "humanizar trecho");
        send({ type: "done", debited: credits, balance: balance - credits });
        controller.close();
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error ? `Falha ao humanizar: ${err.message}` : "Falha ao humanizar.",
        });
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
