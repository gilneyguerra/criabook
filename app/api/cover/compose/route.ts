import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getBookForUser, upsertCover } from "@/lib/db/queries";
import { hasBlob, persistBytes } from "@/lib/storage/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Recebe o JPG composto no cliente (canvas 2500×3500) e o persiste no Blob. */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!hasBlob()) {
    return NextResponse.json(
      { error: "Armazenamento não configurado (defina BLOB_READ_WRITE_TOKEN)." },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  const bookId = String(form?.get("bookId") ?? "");
  const file = form?.get("file");
  if (!bookId || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) {
    return NextResponse.json({ error: "Livro não encontrado." }, { status: 404 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const url = await persistBytes(`covers/${bookId}/ebook`, buf, "image/jpeg");
  if (!url) {
    return NextResponse.json({ error: "Falha ao salvar a capa." }, { status: 502 });
  }

  await upsertCover(bookId, { ebookCoverUrl: url });
  return NextResponse.json({ url });
}
