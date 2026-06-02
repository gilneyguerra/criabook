"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { createBookForUser } from "@/lib/db/queries";

export async function createBook() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const book = await createBookForUser(session.user.id, {});
  redirect(`/studio/${book.id}/prompt`);
}
