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
  index?: number;
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
    messages: [
      { role: "user", content: buildContinuePrompt(params.context, params.index) },
    ],
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
            type: {
              type: "string",
              description:
                "hallucination | repetition | timeline | knowledge | thread",
            },
            severity: {
              type: "string",
              description: "hard (contradição factual) | soft (estilística)",
            },
            description: { type: "string" },
            conflictsWith: {
              type: "string",
              description: "fato/evento em conflito + proveniência (ex.: 'cap.1 diz verdes')",
            },
            location: { type: "string", description: "capítulo/onde ocorre" },
          },
          required: ["type", "severity", "description"],
        },
      },
    },
    required: ["issues"],
  },
};

const ISSUE_TYPES = [
  "hallucination",
  "repetition",
  "timeline",
  "knowledge",
  "thread",
] as const;
export type ConsistencyIssueType = (typeof ISSUE_TYPES)[number];

export type ConsistencyIssue = {
  type: ConsistencyIssueType;
  severity: "hard" | "soft";
  description: string;
  conflictsWith?: string;
  location?: string;
};

function normalizeType(t: string): ConsistencyIssueType {
  const v = t.toLowerCase().trim();
  return (ISSUE_TYPES as readonly string[]).includes(v)
    ? (v as ConsistencyIssueType)
    : "hallucination";
}

/**
 * Passe de QA (laço detector): confronta o manuscrito contra os ledgers
 * (cânone/timeline/conhecimento/fios) + Bíblia e reporta contradições com
 * tipo, severidade e proveniência.
 */
export async function checkConsistency(
  context: string
): Promise<ConsistencyIssue[]> {
  const anthropic = getAnthropic();
  if (!anthropic) return [];

  const res = await anthropic.messages.create({
    model: MODEL_MAIN,
    max_tokens: 2000,
    system:
      "Você é um editor de continuidade. Os FATOS DO CÂNONE, TIMELINE, " +
      "CONHECIMENTO e FIOS abaixo são a fonte de verdade. Compare os RESUMOS dos " +
      "capítulos contra eles e reporte CONTRADIÇÕES, não impressões: grafia de " +
      "nome que muda, traço físico alterado, furo de linha do tempo, personagem " +
      "que age sobre o que ainda não sabe, morto que reaparece, regra do mundo " +
      "violada, fio aberto nunca pago, repetição. Para cada uma, dê o tipo, a " +
      "severidade (hard=contradição factual; soft=estilística) e em conflictsWith " +
      "cite o fato/proveniência conflitante. Sem problemas → lista vazia. Em pt-BR.",
    messages: [{ role: "user", content: context }],
    tools: [CONSISTENCY_TOOL],
    tool_choice: { type: "tool", name: CONSISTENCY_TOOL.name },
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return [];
  const input = block.input as {
    issues?: {
      type?: string;
      severity?: string;
      description?: string;
      conflictsWith?: string;
      location?: string;
    }[];
  };
  if (!Array.isArray(input.issues)) return [];
  return input.issues.map((i) => ({
    type: normalizeType(String(i.type ?? "hallucination")),
    severity: String(i.severity ?? "soft").toLowerCase() === "hard" ? "hard" : "soft",
    description: String(i.description ?? ""),
    conflictsWith: i.conflictsWith ? String(i.conflictsWith) : undefined,
    location: i.location ? String(i.location) : undefined,
  }));
}

/**
 * Auto-revisão dirigida (§5): reescreve um capítulo corrigindo UMA
 * inconsistência, mexendo o mínimo possível. Retorna o texto corrigido ou null.
 */
export async function reviseChapterForIssue(params: {
  text: string;
  description: string;
  conflictsWith?: string | null;
}): Promise<string | null> {
  const anthropic = getAnthropic();
  if (!anthropic || !params.text.trim()) return null;
  try {
    const res = await anthropic.messages.create({
      model: MODEL_MAIN,
      max_tokens: 4000,
      system:
        "Você é um editor de continuidade. Reescreva o capítulo corrigindo APENAS " +
        "a inconsistência indicada, com o MÍNIMO de alterações (preserve enredo, " +
        "tom, POV, tipografia PT-BR — travessão no diálogo, aspas curvas). " +
        "Responda só com o texto do capítulo corrigido, sem comentários.",
      messages: [
        {
          role: "user",
          content:
            `INCONSISTÊNCIA: ${params.description}\n` +
            (params.conflictsWith ? `FATO CORRETO (cânone): ${params.conflictsWith}\n` : "") +
            `\n--- CAPÍTULO ---\n${params.text.slice(0, 16000)}`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : null;
  } catch {
    return null;
  }
}

/* ----------------- Extração de estado pós-geração (§5/§3) ----------------- */

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "registrar_estado",
  description:
    "Registra o estado estruturado extraído do capítulo: fatos do cânone, " +
    "eventos, conhecimento adquirido, descritos, fios de trama.",
  input_schema: {
    type: "object",
    properties: {
      facts: {
        type: "array",
        description: "Fatos atômicos e DURÁVEIS estabelecidos (não efêmeros).",
        items: {
          type: "object",
          properties: {
            subject: { type: "string", description: "personagem/lugar/conceito" },
            attribute: { type: "string", description: "ex.: cor_dos_olhos, regra, parentesco" },
            value: { type: "string" },
          },
          required: ["subject", "attribute", "value"],
        },
      },
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            storyTime: { type: "string", description: "ex.: 'Dia 3, manhã'" },
            participants: { type: "array", items: { type: "string" } },
            location: { type: "string" },
          },
          required: ["description"],
        },
      },
      knowledge: {
        type: "array",
        description: "O que cada personagem passou a saber neste capítulo.",
        items: {
          type: "object",
          properties: {
            character: { type: "string" },
            fact: { type: "string" },
          },
          required: ["character", "fact"],
        },
      },
      describedSubjects: {
        type: "array",
        description: "O que foi descrito por extenso (aparência, ambiente).",
        items: { type: "string" },
      },
      openedThreads: {
        type: "array",
        description: "Promessas/perguntas narrativas abertas neste capítulo.",
        items: { type: "string" },
      },
      closedThreads: {
        type: "array",
        description: "Fios de trama resolvidos neste capítulo.",
        items: { type: "string" },
      },
    },
    required: [],
  },
};

export type ChapterExtraction = {
  facts: { subject: string; attribute: string; value: string }[];
  events: {
    description: string;
    storyTime?: string;
    participants?: string[];
    location?: string;
  }[];
  knowledge: { character: string; fact: string }[];
  describedSubjects: string[];
  openedThreads: string[];
  closedThreads: string[];
};

const EMPTY_EXTRACTION: ChapterExtraction = {
  facts: [],
  events: [],
  knowledge: [],
  describedSubjects: [],
  openedThreads: [],
  closedThreads: [],
};

/** Extrai o estado estruturado de um capítulo (Haiku/tool-use). Vazio sem key. */
export async function extractChapterState(
  text: string,
  bookContext: string
): Promise<ChapterExtraction> {
  const anthropic = getAnthropic();
  if (!anthropic || !text.trim()) return EMPTY_EXTRACTION;
  try {
    const res = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 1500,
      system:
        "Você extrai memória estruturada de um capítulo para um motor de " +
        "consistência. Registre só fatos DURÁVEIS e verificáveis (não detalhes " +
        "efêmeros). Seja conciso, em pt-BR. Use o contexto do livro para nomes.",
      messages: [
        {
          role: "user",
          content: `${bookContext}\n\n--- CAPÍTULO ---\n${text.slice(0, 14000)}`,
        },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return EMPTY_EXTRACTION;
    const inp = block.input as Partial<ChapterExtraction>;
    return {
      facts: Array.isArray(inp.facts) ? inp.facts : [],
      events: Array.isArray(inp.events) ? inp.events : [],
      knowledge: Array.isArray(inp.knowledge) ? inp.knowledge : [],
      describedSubjects: Array.isArray(inp.describedSubjects) ? inp.describedSubjects : [],
      openedThreads: Array.isArray(inp.openedThreads) ? inp.openedThreads : [],
      closedThreads: Array.isArray(inp.closedThreads) ? inp.closedThreads : [],
    };
  } catch {
    return EMPTY_EXTRACTION;
  }
}

/* ------------------- Geração da Bíblia por IA (FLUXO_E_UX) ------------------- */

const BIBLE_TOOL: Anthropic.Tool = {
  name: "montar_biblia",
  description:
    "Propõe elementos da Bíblia da história (mundo) coerentes com a base do livro.",
  input_schema: {
    type: "object",
    properties: {
      characters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string", description: "protagonista, antagonista, secundário" },
            appearance: { type: "string" },
            traits: { type: "string" },
            arc: { type: "string", description: "arco/transformação" },
          },
          required: ["name"],
        },
      },
      locations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["name"],
        },
      },
      worldRules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", description: "magia, tecnologia, política…" },
            rule: { type: "string" },
          },
          required: ["rule"],
        },
      },
      timeline: {
        type: "array",
        items: {
          type: "object",
          properties: {
            order: { type: "number" },
            description: { type: "string" },
          },
          required: ["description"],
        },
      },
    },
    required: [],
  },
};

export type BibleSection = "character" | "location" | "world_rule" | "timeline";

export type GeneratedBible = {
  characters: { name: string; role?: string; appearance?: string; traits?: string; arc?: string }[];
  locations: { name: string; description?: string }[];
  worldRules: { category?: string; rule: string }[];
  timeline: { order?: number; description: string }[];
};

const SECTION_LABEL: Record<BibleSection, string> = {
  character: "personagens (com papel, aparência, traços e arco)",
  location: "locais (com descrição)",
  world_rule: "regras do mundo",
  timeline: "esqueleto de linha do tempo (eventos em ordem)",
};

/**
 * Gera a Bíblia (mundo) a partir da base. Sem `section` = cascata (tudo);
 * com `section` = só aquela seção. Vazio sem API key.
 */
export async function generateBible(
  bookContext: string,
  section?: BibleSection
): Promise<GeneratedBible> {
  const empty: GeneratedBible = { characters: [], locations: [], worldRules: [], timeline: [] };
  const anthropic = getAnthropic();
  if (!anthropic) return empty;

  const alvo = section
    ? `Gere APENAS ${SECTION_LABEL[section]}.`
    : "Gere o elenco, os locais, as regras do mundo e um esqueleto de linha do tempo.";

  try {
    const res = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 2000,
      system:
        "Você é um editor de desenvolvimento. A partir da base do livro (logline, " +
        "gênero, tom, método), proponha uma Bíblia da história COERENTE com esse DNA. " +
        `${alvo} Seja específico e conciso, em pt-BR. Não repita itens triviais.`,
      messages: [{ role: "user", content: bookContext }],
      tools: [BIBLE_TOOL],
      tool_choice: { type: "tool", name: BIBLE_TOOL.name },
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return empty;
    const inp = block.input as Partial<GeneratedBible>;
    return {
      characters: Array.isArray(inp.characters) ? inp.characters : [],
      locations: Array.isArray(inp.locations) ? inp.locations : [],
      worldRules: Array.isArray(inp.worldRules) ? inp.worldRules : [],
      timeline: Array.isArray(inp.timeline) ? inp.timeline : [],
    };
  } catch {
    return empty;
  }
}

/** Sugere o texto de UM campo da base (logline/público/tom). "" sem API key. */
export async function suggestField(
  kind: "logline" | "audience" | "tone",
  bookContext: string
): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic) return "";
  const pedido =
    kind === "logline"
      ? "uma logline/promessa central forte (1 frase) que dê vontade de ler"
      : kind === "audience"
        ? "o público-alvo e o nível de leitura (1 frase curta)"
        : "o tom da obra (3 a 6 adjetivos/expressões, ex.: sombrio, lírico, irônico)";
  try {
    const res = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 200,
      system: `Sugira ${pedido}, coerente com a base do livro. Responda só o texto, em pt-BR, sem aspas nem rótulos.`,
      messages: [{ role: "user", content: bookContext }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : "";
  } catch {
    return "";
  }
}

export type MatterKind = "dedication" | "epigraph" | "preface" | "acknowledgments" | "cta";

const MATTER_COPY: Record<MatterKind, string> = {
  dedication: "Escreva uma DEDICATÓRIA curta e tocante (1 a 2 linhas).",
  epigraph:
    "Sugira uma EPÍGRAFE: citação curta de abertura, coerente com o tema/tom. " +
    "Pode ser uma frase original do universo do livro, com atribuição fictícia.",
  preface:
    "Escreva um PREFÁCIO breve (1 a 2 parágrafos curtos) apresentando a obra ao leitor.",
  acknowledgments: "Escreva uma seção de AGRADECIMENTOS breve e calorosa (3 a 5 linhas).",
  cta:
    "Escreva uma CHAMADA FINAL (CTA) curta convidando o leitor (avaliar, " +
    "newsletter, próximo livro). 2 a 3 linhas.",
};

/** Sugere o texto de um campo do front/back matter. "" sem API key. */
export async function suggestMatterField(
  kind: MatterKind,
  bookContext: string
): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic) return "";
  try {
    const res = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 500,
      system: `${MATTER_COPY[kind]} Coerente com o livro. pt-BR. Responda só o texto, sem rótulos nem aspas ao redor.`,
      messages: [{ role: "user", content: bookContext }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : "";
  } catch {
    return "";
  }
}

/** Sugere uma direção de arte para a capa (Camada 1). "" sem API key. */
export async function suggestCoverArt(bookContext: string): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic) return "";
  try {
    const res = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 200,
      system:
        "Sugira a DIREÇÃO DE ARTE da capa em UMA frase rica: sujeito/cena, " +
        "atmosfera, enquadramento e luz, coerente com o livro. NÃO mencione " +
        "texto, título ou tipografia. pt-BR. Responda só a descrição.",
      messages: [{ role: "user", content: bookContext }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : "";
  } catch {
    return "";
  }
}

const STYLE_TOOL: Anthropic.Tool = {
  name: "sugerir_estilo_capa",
  description: "Sugere estilo visual, paleta e cores de capa coerentes com o livro.",
  input_schema: {
    type: "object",
    properties: {
      style: { type: "string", description: "ex.: 'fotográfico sombrio', 'pictórico épico'" },
      palette: { type: "string", description: "cores dominantes + acento" },
      background: { type: "string", description: "cor de fundo hex, ex.: #10162e" },
      titleColor: { type: "string", description: "cor do título hex" },
    },
    required: ["style", "palette"],
  },
};

export type CoverStyle = {
  style: string;
  palette: string;
  background?: string;
  titleColor?: string;
};

/** Sugere estilo/paleta/cores de capa a partir do livro (gênero/tom). */
export async function suggestCoverStyle(bookContext: string): Promise<CoverStyle | null> {
  const anthropic = getAnthropic();
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 400,
      system:
        "Você é diretor de arte de capas. A partir do livro (gênero, tom, logline), " +
        "proponha um estilo visual, uma paleta e cores (fundo/título em hex) que " +
        "vendam o livro na estante. Seja específico ao gênero, em pt-BR.",
      messages: [{ role: "user", content: bookContext }],
      tools: [STYLE_TOOL],
      tool_choice: { type: "tool", name: STYLE_TOOL.name },
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return null;
    const inp = block.input as Partial<CoverStyle>;
    if (!inp.style || !inp.palette) return null;
    return {
      style: String(inp.style),
      palette: String(inp.palette),
      background: inp.background ? String(inp.background) : undefined,
      titleColor: inp.titleColor ? String(inp.titleColor) : undefined,
    };
  } catch {
    return null;
  }
}

/** Direção de arte da CONTRA CAPA que complementa a capa frontal. "" sem key. */
export async function suggestComplementaryArt(
  frontPrompt: string,
  style: string,
  palette: string
): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic) return "";
  try {
    const res = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 200,
      system:
        "A capa FRONTAL de um livro mostra a cena descrita pelo usuário. Sugira a " +
        "cena da CONTRA CAPA que COMPLEMENTE a frontal e CONVERSE com ela: MESMO " +
        "estilo, paleta e atmosfera, como continuação visual (ex.: outro ângulo da " +
        "mesma cena, o 'depois', um detalhe ampliado, o reverso do cenário). " +
        "Puramente visual, SEM texto. UMA frase rica, em pt-BR. Responda só a descrição.",
      messages: [
        {
          role: "user",
          content: `Capa frontal: ${frontPrompt}\nEstilo: ${style || "—"}\nPaleta: ${palette || "—"}`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : "";
  } catch {
    return "";
  }
}

/* ------------------- Textos comerciais da capa (FERRAMENTA_CAPA) ------------------- */

const COVER_COPY_SYSTEM: Record<"back" | "flapFront" | "bio", string> = {
  back:
    "Escreva o TEXTO DE APRESENTAÇÃO DA CONTRA CAPA. NÃO é sinopse: é peça comercial. " +
    "3ª pessoa, foco no benefício/transformação que a obra entrega ao leitor. " +
    "3 a 5 parágrafos curtos e persuasivos. pt-BR. Responda só o texto.",
  flapFront:
    "Escreva a ORELHA DA CAPA: abordagem editorial (como a obra se organiza/o que " +
    "aborda) OU uma frase de impacto seguida de um breve gancho. Comercial, pt-BR. " +
    "Responda só o texto.",
  bio:
    "Escreva uma BIOGRAFIA do autor em 3ª pessoa, focada na autoridade/experiência " +
    "no tema da obra. 2 a 3 frases. pt-BR. Se houver uma bio anterior no contexto, " +
    "refine-a mantendo os fatos. Responda só o texto.",
};

/** Gera um texto comercial da capa (contra capa, orelha ou bio). "" sem API key. */
export async function generateCoverText(
  kind: "back" | "flapFront" | "bio",
  bookContext: string
): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic) return "";
  try {
    const res = await anthropic.messages.create({
      model: MODEL_MAIN,
      max_tokens: 1000,
      system: COVER_COPY_SYSTEM[kind],
      messages: [{ role: "user", content: bookContext }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : "";
  } catch {
    return "";
  }
}

const SOCIAL_TOOL: Anthropic.Tool = {
  name: "prova_social",
  description: "Rascunhos de depoimentos curtos (prova social) para a contra capa.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            quote: { type: "string", description: "2 a 3 linhas" },
            author: { type: "string", description: "papel/veículo, ex.: 'Crítico literário'" },
          },
          required: ["quote", "author"],
        },
      },
    },
    required: ["items"],
  },
};

/** Rascunha 1–2 depoimentos (o autor edita/substitui). [] sem API key. */
export async function generateSocialProof(
  bookContext: string
): Promise<{ quote: string; author: string }[]> {
  const anthropic = getAnthropic();
  if (!anthropic) return [];
  try {
    const res = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 600,
      system:
        "Rascunhe 1 a 2 depoimentos curtos de prova social para a contra capa, no tom " +
        "do livro. São RASCUNHOS a confirmar pelo autor (não atribua a pessoas reais). " +
        "pt-BR.",
      messages: [{ role: "user", content: bookContext }],
      tools: [SOCIAL_TOOL],
      tool_choice: { type: "tool", name: SOCIAL_TOOL.name },
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return [];
    const inp = block.input as { items?: { quote?: string; author?: string }[] };
    if (!Array.isArray(inp.items)) return [];
    return inp.items.map((i) => ({
      quote: String(i.quote ?? ""),
      author: String(i.author ?? ""),
    }));
  } catch {
    return [];
  }
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
