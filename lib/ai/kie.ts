/**
 * Cliente mínimo da Kie.ai (https://docs.kie.ai) para geração de imagem.
 * Padrão assíncrono: createTask -> polling em recordInfo. resultJson é uma
 * STRING JSON com { resultUrls }. Sem dependências; guardado sem API key.
 *
 * Erros são PROPAGADOS (KieError) com o motivo real (status/código/corpo) para
 * facilitar o diagnóstico; as rotas decidem como exibir.
 *
 * Obs.: as URLs da Kie.ai expiram (~14 dias) — rehospedamos no Vercel Blob.
 */

const BASE = process.env.KIE_AI_BASE_URL ?? "https://api.kie.ai";
const KEY = process.env.KIE_AI_API_KEY;
export const KIE_MODEL = process.env.KIE_DEFAULT_MODEL ?? "google/imagen4-ultra";

export class KieError extends Error {}

export function hasKie(): boolean {
  return Boolean(KEY);
}

async function createTask(prompt: string): Promise<string> {
  if (!KEY) throw new KieError("KIE_AI_API_KEY ausente.");
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: KIE_MODEL, input: { prompt } }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new KieError(`createTask falhou na rede: ${String(e)}`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new KieError(`createTask HTTP ${res.status} (modelo ${KIE_MODEL}): ${text.slice(0, 300)}`);
  }
  let json: { code?: number; msg?: string; message?: string; data?: { taskId?: string } } | null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new KieError(`createTask resposta não-JSON: ${text.slice(0, 200)}`);
  }
  if (!json || json.code !== 200) {
    throw new KieError(
      `createTask code ${json?.code} (modelo ${KIE_MODEL}): ${json?.msg ?? json?.message ?? text.slice(0, 200)}`
    );
  }
  if (!json.data?.taskId) {
    throw new KieError(`createTask sem taskId: ${text.slice(0, 200)}`);
  }
  return json.data.taskId;
}

async function recordInfo(
  taskId: string
): Promise<{ state: string; urls: string[]; failMsg?: string } | null> {
  if (!KEY) return null;
  const res = await fetch(
    `${BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(20_000) }
  );
  if (!res.ok) return null; // transiente: tenta de novo no polling
  const json = (await res.json().catch(() => null)) as
    | { data?: { state?: string; resultJson?: string | null; failMsg?: string } }
    | null;
  const data = json?.data;
  if (!data?.state) return null;

  let urls: string[] = [];
  if (data.resultJson) {
    try {
      const r = JSON.parse(data.resultJson) as { resultUrls?: string[] };
      if (Array.isArray(r.resultUrls)) urls = r.resultUrls;
    } catch {
      // ignora resultJson inválido
    }
  }
  return { state: data.state, urls, failMsg: data.failMsg };
}

/**
 * Gera uma imagem e retorna a 1ª URL. LANÇA KieError em falha (motivo real).
 */
export async function generateImage(
  prompt: string,
  timeoutMs = 55_000
): Promise<string> {
  const taskId = await createTask(prompt);

  const start = Date.now();
  let interval = 2_500;
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, interval));
    const info = await recordInfo(taskId);
    if (!info) continue;
    if (info.state === "success") {
      const url = info.urls[0];
      if (!url) throw new KieError("Kie retornou sucesso sem URL de imagem.");
      return url;
    }
    if (info.state === "fail") {
      throw new KieError(`Kie falhou: ${info.failMsg ?? "sem detalhe"}`);
    }
    interval = Math.min(interval * 1.5, 8_000);
  }
  throw new KieError("Tempo esgotado aguardando a imagem (a geração demorou demais).");
}
