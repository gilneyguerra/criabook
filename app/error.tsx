"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="font-serif text-2xl font-semibold">Algo deu errado</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Ocorreu um erro ao carregar esta tela. Você pode tentar de novo — seu
        trabalho salvo está seguro.
      </p>
      {error?.message && (
        <pre className="max-w-md overflow-auto rounded-md bg-secondary/60 p-3 text-left text-xs text-muted-foreground">
          {error.message}
          {error.digest ? `\n(digest: ${error.digest})` : ""}
        </pre>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-600"
        >
          Tentar de novo
        </button>
        <a
          href="/dashboard"
          className="rounded-full border px-5 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Voltar ao dashboard
        </a>
      </div>
    </div>
  );
}
