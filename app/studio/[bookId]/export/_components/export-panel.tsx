"use client";

import Link from "next/link";
import { BookDown, FileText, ShieldCheck, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExportPanel({
  bookId,
  bookTitle,
  chapterCount,
}: {
  bookId: string;
  bookTitle: string;
  chapterCount: number;
}) {
  const ready = chapterCount > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-indigo-500">
          <BookDown className="size-4" /> Passo 6 · Exportar
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">{bookTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gere os arquivos finais usando o Perfil de diagramação definido em
          Base & Bíblia. {ready ? "" : "Gere ao menos um capítulo para exportar."}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* EPUB — disponível */}
        <div className="flex items-center justify-between rounded-xl border p-5">
          <div>
            <h2 className="flex items-center gap-2 font-medium">
              <BookDown className="size-4 text-indigo-500" /> EPUB 3
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700">
                disponível
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reflowable, sumário navegável, tipografia do Perfil de Layout.
            </p>
          </div>
          <Button asChild disabled={!ready}>
            <a href={ready ? `/api/export?bookId=${bookId}` : undefined} title="Baixar EPUB">
              <BookDown className="size-4" />
              Baixar EPUB
            </a>
          </Button>
        </div>

        {/* PDF impressão — em breve */}
        <div className="flex items-center justify-between rounded-xl border border-dashed p-5 opacity-70">
          <div>
            <h2 className="flex items-center gap-2 font-medium">
              <FileText className="size-4" /> PDF de impressão (PDF/X)
              <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs text-zinc-600">
                em breve
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Miolo paginado com medianiz, fólios e sangria — pronto para POD/KDP.
            </p>
          </div>
          <Button variant="outline" disabled>
            Gerar PDF
          </Button>
        </div>

        {/* Validação EPUBCheck — em breve */}
        <div className="flex items-center justify-between rounded-xl border border-dashed p-5 opacity-70">
          <div>
            <h2 className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4" /> Validar (EPUBCheck)
              <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs text-zinc-600">
                em breve
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Conferência de conformidade exigida pelas lojas antes de publicar.
            </p>
          </div>
          <Button variant="outline" disabled>
            Validar
          </Button>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3 border-t pt-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Check className="size-4" />
          Concluir
        </Link>
      </div>
    </div>
  );
}
