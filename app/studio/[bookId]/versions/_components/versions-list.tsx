"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, RotateCcw, Loader2 } from "lucide-react";

import { restoreVersion } from "../actions";
import { Button } from "@/components/ui/button";

type Version = {
  id: string;
  label: string;
  chapterTitle: string | null;
  createdAt: string;
};

export function VersionsList({
  bookId,
  bookTitle,
  versions,
}: {
  bookId: string;
  bookTitle: string;
  versions: Version[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function restore(id: string) {
    setPending(id);
    setMessage(null);
    const res = await restoreVersion(bookId, id);
    setPending(null);
    if (res?.ok) {
      setMessage("Versão restaurada.");
      router.refresh();
    } else {
      setMessage(res?.error ?? "Falha ao restaurar.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-indigo-500">
          <History className="size-4" /> Versões
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">{bookTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cada geração e cada versão manual viram um ponto restaurável. O
          histórico nunca é apagado — o rollback também cria um registro.
        </p>
        {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma versão ainda. Gere um capítulo ou use “Versão” no editor.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{v.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {v.chapterTitle ? `${v.chapterTitle} · ` : ""}
                  {v.createdAt
                    ? new Date(v.createdAt).toLocaleString("pt-BR")
                    : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restore(v.id)}
                disabled={pending === v.id}
              >
                {pending === v.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Restaurar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
