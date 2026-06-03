/**
 * Persistência durável no Vercel Blob. As URLs da Kie.ai expiram (~14 dias);
 * a arte e a capa composta são rehospedadas aqui (mesmo domínio + CORS, o que
 * também evita "tainted canvas" na composição do JPG). Guarda graciosa: sem
 * BLOB_READ_WRITE_TOKEN, devolve a URL original (degrada sem quebrar).
 */

import { put } from "@vercel/blob";

export function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Persiste bytes no Blob e retorna a URL pública (null sem token). */
export async function persistBytes(
  key: string,
  body: Buffer | Uint8Array | ArrayBuffer,
  contentType: string
): Promise<string | null> {
  if (!hasBlob()) return null;
  const blob = await put(key, body, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

/** Baixa uma URL externa e a rehospeda no Blob. Fallback: a própria URL. */
export async function persistFromUrl(
  key: string,
  url: string,
  fallbackType = "image/png"
): Promise<string> {
  if (!hasBlob()) return url;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return url;
    const buf = Buffer.from(await res.arrayBuffer());
    const out = await persistBytes(
      key,
      buf,
      res.headers.get("content-type") ?? fallbackType
    );
    return out ?? url;
  } catch {
    return url;
  }
}
