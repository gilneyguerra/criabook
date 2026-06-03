import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getBookForUser, getChapters, getBookMeta, getCover } from "@/lib/db/queries";
import { buildEpub } from "@/lib/export/epub";
import type { Matter } from "@/lib/matter";
import { getLayoutProfile } from "@/lib/layout/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const bookId = new URL(request.url).searchParams.get("bookId") ?? "";
  const book = await getBookForUser(bookId, session.user.id).catch(() => null);
  if (!book) {
    return NextResponse.json({ error: "Livro não encontrado." }, { status: 404 });
  }

  const chapters = await getChapters(bookId);
  if (!chapters.length) {
    return NextResponse.json(
      { error: "Gere ao menos um capítulo antes de exportar." },
      { status: 400 }
    );
  }
  const meta = await getBookMeta(bookId).catch(() => null);
  const matter = (meta?.matter ?? {}) as Matter;
  const profile = getLayoutProfile(book.layoutProfileId, book.type);
  const cover = await getCover(bookId).catch(() => null);

  const buffer = await buildEpub(
    book,
    chapters,
    matter,
    new Date().getFullYear(),
    profile,
    cover?.ebookCoverUrl ?? null
  );
  const filename =
    (book.title ?? "livro").replace(/[^\w\-]+/g, "_").slice(0, 60) + ".epub";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
