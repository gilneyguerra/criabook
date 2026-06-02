/**
 * Cliente mínimo da Kie.ai (https://docs.kie.ai) para geração de imagem.
 * Padrão assíncrono: createTask -> polling em recordInfo. resultJson é uma
 * STRING JSON com { resultUrls }. Sem dependências; guardado sem API key.
 *
 * Obs.: as URLs da Kie.ai expiram (~14 dias). Persistir em storage próprio
 * (Vercel Blob) fica como melhoria — por ora guardamos a URL retornada.
 */

const BASE = process.env.KIE_AI_BASE_URL ?? "https://api.kie.ai";
const KEY = process.env.KIE_AI_API_KEY;
export const KIE_MODEL = process.env.KIE_DEFAULT_MODEL ?? "google/imagen4-ultra";

export function hasKie(): boolean {
  return Boolean(KEY);
}

async function createTask(prompt: string): Promise<string | null> {
  if (!KEY) return null;
  const res = await fetch(`${BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: KIE_MODEL, input: { prompt } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as
    | { code?: number; data?: { taskId?: string } }
    | null;
  if (!json || json.code !== 200 || !json.data?.taskId) return null;
  return json.data.taskId;
}

async function recordInfo(
  taskId: string
): Promise<{ state: string; urls: string[] } | null> {
  if (!KEY) return null;
  const res = await fetch(
    `${BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(15_000) }
  );
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as
    | { data?: { state?: string; resultJson?: string | null } }
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
  return { state: data.state, urls };
}

/** Gera uma imagem e retorna a 1ª URL, ou null (sem key / falha / timeout). */
export async function generateImage(
  prompt: string,
  timeoutMs = 55_000
): Promise<string | null> {
  const taskId = await createTask(prompt);
  if (!taskId) return null;

  const start = Date.now();
  let interval = 2_500;
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, interval));
    const info = await recordInfo(taskId);
    if (!info) continue;
    if (info.state === "success") return info.urls[0] ?? null;
    if (info.state === "fail") return null;
    interval = Math.min(interval * 1.5, 8_000);
  }
  return null;
}
