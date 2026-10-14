import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Medição de consumo de IA por operação.
 *
 * Cada entrada de IA roda dentro de um Meter (via withCredits). O client da
 * Anthropic é instrumentado (instrumentAnthropic) e registra o `usage` de toda
 * chamada feita dentro do contexto — inclusive as internas (resumo, extração
 * com Haiku) — sem precisar mudar a assinatura das funções de IA.
 */

export type AiOp =
  | "chapter"
  | "continue"
  | "humanize"
  | "image"
  | "cover_art"
  | "cover_text"
  | "suggest"
  | "bible"
  | "structure"
  | "consistency"
  | "revise";

type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

type Estimate = {
  /** Tokens no modelo principal (Sonnet). */
  mainIn?: number;
  mainOut?: number;
  /** Tokens no modelo rápido (Haiku). */
  fastIn?: number;
  fastOut?: number;
  images?: number;
};

/**
 * Estimativas para a RESERVA. Saída = max_tokens das chamadas (teto real);
 * entrada ≈ contexto típico. Ajustar pelos dados do ledger (coluna op).
 */
export const OP_ESTIMATES: Record<AiOp, Estimate> = {
  // Contexto ancorado real (~8k) + 3.5k de saída; resumo + extração no Haiku.
  chapter: { mainIn: 8000, mainOut: 3500, fastIn: 8000, fastOut: 2000 },
  continue: { mainIn: 8000, mainOut: 2500, fastIn: 8000, fastOut: 2000 },
  humanize: { mainIn: 3000, mainOut: 2000 },
  image: { images: 1 },
  cover_art: { images: 1 },
  cover_text: { mainIn: 3000, mainOut: 1000, fastIn: 1500, fastOut: 600 },
  suggest: { fastIn: 2000, fastOut: 500 },
  bible: { fastIn: 3000, fastOut: 2000 },
  structure: { fastIn: 3000, fastOut: 2000 },
  consistency: { mainIn: 20000, mainOut: 2000 },
  revise: { mainIn: 12000, mainOut: 4000 },
};

/** Fatores de crédito, ajustáveis por env (sem deploy de código). */
function rates() {
  return {
    perInput: Number(process.env.CREDITS_PER_1K_INPUT_TOKENS ?? 1),
    perOutput: Number(process.env.CREDITS_PER_1K_OUTPUT_TOKENS ?? 5),
    perImage: Number(process.env.CREDITS_PER_IMAGE ?? 20),
    // Haiku custa ~1/3 do Sonnet por token.
    fastFactor: Number(process.env.CREDITS_FAST_MODEL_FACTOR ?? 1 / 3),
  };
}

/** Toda operação de IA custa pelo menos 1 crédito. */
export const MIN_CREDITS = 1;

function toCredits(e: Required<Estimate>): number {
  const r = rates();
  const main = (e.mainIn / 1000) * r.perInput + (e.mainOut / 1000) * r.perOutput;
  const fast =
    ((e.fastIn / 1000) * r.perInput + (e.fastOut / 1000) * r.perOutput) *
    r.fastFactor;
  return Math.max(MIN_CREDITS, Math.ceil(main + fast + e.images * r.perImage));
}

function full(e: Estimate): Required<Estimate> {
  return {
    mainIn: e.mainIn ?? 0,
    mainOut: e.mainOut ?? 0,
    fastIn: e.fastIn ?? 0,
    fastOut: e.fastOut ?? 0,
    images: e.images ?? 0,
  };
}

export function estimateCredits(op: AiOp): number {
  return toCredits(full(OP_ESTIMATES[op]));
}

export class Meter {
  private usage = full({});
  calls = 0;

  constructor(private readonly fastModel: string) {}

  recordTokens(model: string, u: TokenUsage) {
    const input =
      u.input_tokens +
      (u.cache_creation_input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0);
    if (model === this.fastModel) {
      this.usage.fastIn += input;
      this.usage.fastOut += u.output_tokens;
    } else {
      this.usage.mainIn += input;
      this.usage.mainOut += u.output_tokens;
    }
    this.calls++;
  }

  recordImages(n = 1) {
    this.usage.images += n;
    this.calls++;
  }

  /** Custo real em créditos do que foi medido (mínimo 1). */
  credits(): number {
    return toCredits(this.usage);
  }

  snapshot() {
    return { ...this.usage, calls: this.calls };
  }
}

const storage = new AsyncLocalStorage<Meter>();

export function currentMeter(): Meter | undefined {
  return storage.getStore();
}

export function runWithMeter<T>(meter: Meter, fn: () => Promise<T>): Promise<T> {
  return storage.run(meter, fn);
}

/**
 * Instrumenta messages.create/messages.stream de um client Anthropic para
 * registrar o usage no Meter do contexto atual (se houver).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function instrumentAnthropic<C extends { messages: any }>(client: C): C {
  const messages = client.messages;
  const create = messages.create.bind(messages);
  const stream = messages.stream.bind(messages);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages.create = (body: any, opts?: any) => {
    const meter = currentMeter();
    const p = create(body, opts);
    if (meter && !body?.stream) {
      p.then(
        (msg: { usage?: TokenUsage }) => {
          if (msg?.usage) meter.recordTokens(body.model, msg.usage);
        },
        () => {}
      );
    }
    return p;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages.stream = (body: any, opts?: any) => {
    const meter = currentMeter();
    const s = stream(body, opts);
    if (meter) {
      s.on("finalMessage", (msg: { usage?: TokenUsage }) => {
        if (msg?.usage) meter.recordTokens(body.model, msg.usage);
      });
    }
    return s;
  };

  return client;
}
