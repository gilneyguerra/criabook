"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { updateChapterContent } from "@/lib/db/queries";

export async function saveChapter(
  chapterId: string,
  data: { contentJson: unknown; contentText: string }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Não autenticado." };

  const saved = await updateChapterContent(chapterId, session.user.id, data);
  if (!saved) return { error: "Capítulo não encontrado." };

  return { ok: true, savedAt: Date.now() };
}
