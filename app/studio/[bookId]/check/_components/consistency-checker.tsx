"use client";

import { useState } from "react";
import { ShieldCheck, Loader2, AlertTriangle, Check } from "lucide-react";

import { runConsistencyCheck } from "../actions";
import { Button } from "@/components/ui/button";

type Issue = { severity: string; description: string; location?: string };

function severityColor(s: string) {
  const v = s.toLowerCase();
  if (v.startsWith("alt")) return "bg-red-500/15 text-red-700";
  if (v.startsWith("méd") || v.startsWith("med")) return "bg-amber-500/15 text-amber-700";
  return "bg-zinc-500/15 text-zinc-600";
}

export function ConsistencyChecker({
  bookId,
  bookTitle,
}: {
  bookId: string;
  bookTitle: string;
}) {
  const [running, setRunning] = useState(false);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMessage(null);
    setIssues(null);
    const res = await runConsistencyCheck(bookId);
    setRunning(false);
    if (res?.ok) setIssues(res.issues ?? []);
    else setMessage(res?.error ?? "Falha na verificação.");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-indigo-500">
          <ShieldCheck className="size-4" /> Revisão de consistência
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">{bookTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Um passe de QA que varre os resumos dos capítulos e a Bíblia procurando
          contradições (nomes, traços, timeline, regras do mundo).
        </p>
      </div>

      <Button onClick={run} disabled={running}>
        {running ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ShieldCheck className="size-4" />
        )}
        Verificar consistência
      </Button>

      {message && <p className="mt-4 text-sm text-destructive">{message}</p>}

      {issues !== null && (
        <div className="mt-6">
          {issues.length === 0 ? (
            <p className="inline-flex items-center gap-2 rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
              <Check className="size-4" />
              Nenhuma inconsistência encontrada.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {issues.map((it, i) => (
                <li key={i} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-amber-500" />
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${severityColor(it.severity)}`}
                    >
                      {it.severity}
                    </span>
                    {it.location && (
                      <span className="text-xs text-muted-foreground">
                        {it.location}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm">{it.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
