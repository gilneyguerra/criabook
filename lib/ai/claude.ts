import Anthropic from "@anthropic-ai/sdk";

import {
  KEYWORD_SYSTEM,
  buildKeywordPrompt,
  buildChapterSystem,
  buildChapterPrompt,
  HUMANIZER_SYSTEM,
  buildHumanizePrompt,
  buildContinuePrompt,
} from "@/lib/ai/prompts";

export const MODEL_MAIN =
  process.env.ANTHROPIC_MODEL_MAIN ?? "claude-sonnet-4-6";
export const MODEL_FAST =
  process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;

/**
 * Client Anthropic (null se ANTHROPIC_API_KEY não estiver configurada — assim
 * o build/preview não quebra e as features de IA degradam com elegância).
 * O SDK já faz retry com backoff em 429/5xx.
 */
export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey, maxRetries: 3 });
  return client;
}

// Structured output via tool use (estável em qualquer versão do SDK).
const KEYWORD_TOOL: Anthropic.Tool = {
  name: "sugerir_palavras_chave",
  description: "Retorna a lista de palavras-chave sugeridas.",
  input_schema: {
    type: "object",
    properties: {
      palavras: {
        type: "array",
        items: { type: "string" },
        description: "Sugestões curtas, 1 a 3 palavras cada.",
      },
    },
    required: ["palavras"],
  },
};

/**
 * Sugere palavras-chave para uma categoria (Haiku). Retorna [] sem API key.
 */
export async function suggestKeywords(params: {
  categoryLabel: string;
  context?: string;
  count?: number;
}): Promise<string[]> {
  const anthropic = getAnthropic();
  if (!anthropic) return [];

  const { categoryLabel, context, count = 12 } = params;

  const res = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 1024,
    system: KEYWORD_SYSTEM,
    messages: [
      { role: "user", content: buildKeywordPrompt(categoryLabel, count, context) },
    ],
    tools: [KEYWORD_TOOL],
    tool_choice: { type: "tool", name: KEYWORD_TOOL.name },
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return [];

  const input = block.input as { palavras?: unknown };
  if (!Array.isArray(input.palavras)) return [];

  return input.palavras
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .slice(0, count);
}

/**
 * Abre um stream de geração de capítulo (Sonnet). Retorna o MessageStream do
 * SDK (o chamador consome `.on("text")` e `.finalMessage()`), ou null sem key.
 * O brief vai no system com cache_control (ativa quando o contexto cresce).
 */
export function createChapterStream(params: {
  briefText: string;
  index: number;
  prevContext?: string;
}) {
  const anthropic = getAnthropic();
  if (!anthropic) return null;

  return anthropic.messages.stream({
    model: MODEL_MAIN,
    max_tokens: 3500,
    system: [
      {
        type: "text",
        text: buildChapterSystem(params.briefText),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: buildChapterPrompt(params.index, params.prevContext),
      },
    ],
  });
}

/**
 * Continua um capítulo já existente (não reescreve o que há). Mesma base no
 * system (brief); o contexto é o final do texto atual.
 */
export function createContinueStream(params: {
  briefText: string;
  context: string;
}) {
  const anthropic = getAnthropic();
  if (!anthropic) return null;

  return anthropic.messages.stream({
    model: MODEL_MAIN,
    max_tokens: 2500,
    system: [
      {
        type: "text",
        text: buildChapterSystem(params.briefText),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildContinuePrompt(params.context) }],
  });
}

const BEATS_TOOL: Anthropic.Tool = {
  name: "retornar_beats",
  description: "Retorna os beats preenchidos, na MESMA ordem recebida.",
  input_schema: {
    type: "object",
    properties: {
      beats: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["title", "description"],
        },
      },
    },
    required: ["beats"],
  },
};

/**
 * Gera título + descrição de cada beat do método estrutural, específicos para
 * o livro. Recebe os rótulos canônicos (em ordem) e devolve na mesma ordem.
 */
export async function generateBeats(
  bookContext: string,
  labels: string[]
): Promise<{ title: string; description: string }[]> {
  const anthropic = getAnthropic();
  if (!anthropic) return [];

  const res = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 2000,
    system:
      "Você é um roteirista/editor. Para cada beat do método estrutural, escreva " +
      "um título curto e uma descrição de 1 a 2 frases, ESPECÍFICOS para este livro " +
      "(use a logline, o tom e a base). Responda na MESMA ordem recebida, em pt-BR.",
    messages: [
      {
        role: "user",
        content:
          `${bookContext}\n\nBeats (preencha cada um, nesta ordem):\n` +
          labels.map((l, i) => `${i + 1}. ${l}`).join("\n"),
      },
    ],
    tools: [BEATS_TOOL],
    tool_choice: { type: "tool", name: BEATS_TOOL.name },
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return [];
  const input = block.input as {
    beats?: { title?: string; description?: string }[];
  };
  if (!Array.isArray(input.beats)) return [];
  return input.beats.map((b) => ({
    title: String(b.title ?? ""),
    description: String(b.description ?? ""),
  }));
}

const CONSISTENCY_TOOL: Anthropic.Tool = {
  name: "reportar_inconsistencias",
  description: "Lista as inconsistências de continuidade encontradas.",
  input_schema: {
    type: "object",
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: { type: "string", description: "alta | média | baixa" },
            description: { type: "string" },
            location: { type: "string", description: "capítulo/onde ocorre" },
          },
          required: ["severity", "description"],
        },
      },
    },
    required: ["issues"],
  },
};

export type ConsistencyIssue = {
  severity: string;
  description: string;
  location?: string;
};

/** Passe de QA: encontra contradições no manuscrito (usa resumos + Bíblia). */
export async function checkConsistency(
  context: string
): Promise<ConsistencyIssue[]> {
  const anthropic = getAnthropic();
  if (!anthropic) return [];

  const res = await anthropic.messages.create({
    model: MODEL_MAIN,
    max_tokens: 2000,
    system:
      "Você é um editor de continuidade. Analise o manuscrito (resumos dos " +
      "capítulos + Bíblia) e encontre contradições: grafia de nome que muda, " +
      "traço físico alterado, furo na linha do tempo, personagem morto que " +
      "reaparece, regra do mundo violada, fatos incoerentes. Seja específico e " +
      "cite onde. Se não houver problemas, retorne uma lista vazia. Em pt-BR.",
    messages: [{ role: "user", content: context }],
    tools: [CONSISTENCY_TOOL],
    tool_choice: { type: "tool", name: CONSISTENCY_TOOL.name },
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return [];
  const input = block.input as {
    issues?: { severity?: string; description?: string; location?: string }[];
  };
  if (!Array.isArray(input.issues)) return [];
  return input.issues.map((i) => ({
    severity: String(i.severity ?? "média"),
    description: String(i.description ?? ""),
    location: i.location ? String(i.location) : undefined,
  }));
}

/** Traduz erros conhecidos da IA em mensagens amigáveis (o técnico fica nos logs). */
export function friendlyAiError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("overloaded"))
    return "O serviço de IA está sobrecarregado agora. Tente novamente em alguns segundos.";
  if (msg.includes("credit balance") || msg.includes("billing"))
    return "O serviço de IA está temporariamente indisponível. Tente mais tarde.";
  if (msg.includes("rate_limit") || msg.includes("429"))
    return "Muitas solicitações seguidas. Aguarde um instante e tente de novo.";
  if (
    msg.includes("authentication") ||
    msg.includes("x-api-key") ||
    msg.includes("401")
  )
    return "Serviço de IA indisponível (configuração). Avise o administrador.";
  return "Não foi possível concluir agora. Tente novamente.";
}

/**
 * Abre um stream que reescreve um trecho de forma mais humana (skill humanizer).
 * Retorna o MessageStream do SDK, ou null sem API key.
 */
export function createHumanizeStream(params: { text: string }) {
  const anthropic = getAnthropic();
  if (!anthropic) return null;

  return anthropic.messages.stream({
    model: MODEL_MAIN,
    max_tokens: 2000,
    system: HUMANIZER_SYSTEM,
    messages: [{ role: "user", content: buildHumanizePrompt(params.text) }],
  });
}
