import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { createHumanizeStream, friendlyAiError } from "@/lib/ai/claude";
import {
  creditErrorResponse,
  startMetered,
  type MeteredOp,
} from "@/lib/ai/with-credits";
import { normalize } from "@/lib/text/normalizer";
import { getLayoutProfile } from "@/lib/layout/profile";

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

  // Reserva antes de abrir o stream; acerto ou estorno no finally.
  let metered: MeteredOp;
  try {
    metered = await startMetered(session.user.id, "humanize");
  } catch (err) {
    const res = creditErrorResponse(err);
    if (res) return res;
    throw err;
  }

  // Criado dentro do meter: o usage do stream entra no acerto.
  const stream = await metered.run(async () => createHumanizeStream({ text: input }));
  if (!stream) {
    await metered.refund();
    return NextResponse.json(
      { error: "IA não configurada (defina ANTHROPIC_API_KEY)." },
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();
  // Perfil default só para as regras de TEXTO (locale pt-BR) — idênticas em
  // todos os presets, então não precisamos do bookId aqui.
  const profile = getLayoutProfile(undefined, "fiction");

  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      let full = "";
      let settled = false;
      try {
        stream.on("text", (delta: string) => {
          full += delta;
          send({ type: "delta", text: delta });
        });
        await stream.finalMessage();
        const { charged, balance } = await metered.settle();
        settled = true;
        // Saída normalizada: o cliente substitui a seleção por este texto.
        send({
          type: "done",
          text: normalize(full, profile),
          debited: charged,
          balance,
        });
      } catch (err) {
        console.error("humanize error", err);
        send({ type: "error", message: friendlyAiError(err) });
      } finally {
        if (!settled) await metered.refund();
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
