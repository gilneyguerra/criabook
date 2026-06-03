"use client";

import { useMemo, useState } from "react";
import {
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Check,
  Wrench,
  X,
  GitBranch,
  Clock,
} from "lucide-react";

import {
  runConsistencyCheck,
  resolveIssue,
  ignoreIssue,
  correctPassage,
} from "../actions";
import { Button } from "@/components/ui/button";

type Issue = {
  id: string;
  chapter: number | null;
  type: string;
  severity: string;
  description: string;
  conflictsWith: string | null;
  status: string;
};
type Thread = {
  id: string;
  description: string;
  openedInChapter: number;
  closedInChapter: number | null;
  status: string;
};
type Event = {
  id: string;
  order: number;
  description: string;
  chapterRef: number | null;
  storyTime: string | null;
  participants: string[];
};

const TYPE_LABEL: Record<string, string> = {
  hallucination: "Alucinação",
  repetition: "Repetição",
  timeline: "Linha do tempo",
  knowledge: "Conhecimento",
  thread: "Fio de trama",
};

export function ConsistencyChecker({
  bookId,
  bookTitle,
  initialIssues,
  threads,
  timeline,
}: {
  bookId: string;
  bookTitle: string;
  initialIssues: Issue[];
  threads: Thread[];
  timeline: Event[];
}) {
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hard" | "soft">("all");
  const [message, setMessage] = useState<string | null>(null);

  const open = useMemo(
    () => issues.filter((i) => i.status === "open"),
    [issues]
  );
  const shown = useMemo(
    () => (filter === "all" ? open : open.filter((i) => i.severity === filter)),
    [open, filter]
  );

  async function run() {
    setRunning(true);
    setMessage(null);
    const res = await runConsistencyCheck(bookId);
    setRunning(false);
    if (res?.ok && res.issues) setIssues(res.issues as Issue[]);
    else setMessage(res?.error ?? "Falha na verificação.");
  }

  async function act(
    id: string,
    fn: (b: string, i: string) => Promise<{ ok?: boolean; error?: string; chapter?: number }>
  ) {
    setBusyId(id);
    setMessage(null);
    const res = await fn(bookId, id);
    setBusyId(null);
    if (res?.ok) {
      setIssues((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status: "resolved" } : x))
      );
      if (typeof res.chapter === "number")
        setMessage(`Capítulo ${res.chapter} corrigido (uma versão foi salva antes).`);
    } else {
      setMessage(res?.error ?? "Falha na ação.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-indigo-500">
          <ShieldCheck className="size-4" /> Motor de consistência
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">{bookTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Confronta os capítulos contra a memória do livro (cânone, linha do tempo,
          conhecimento dos personagens e fios de trama) e aponta contradições com
          proveniência.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={run} disabled={running}>
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          Verificar consistência
        </Button>
        <div className="ml-auto flex gap-1 text-sm">
          {(["all", "hard", "soft"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 ${
                filter === f ? "border-indigo-500 text-indigo-600" : "text-muted-foreground"
              }`}
            >
              {f === "all" ? "Todas" : f === "hard" ? "Hard" : "Soft"}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="mt-4 text-sm text-foreground/80">{message}</p>}

      {/* Issues */}
      <div className="mt-6">
        {open.length === 0 ? (
          <p className="inline-flex items-center gap-2 rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
            <Check className="size-4" />
            Nenhuma inconsistência aberta. Rode a verificação após gerar capítulos.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((it) => (
              <li key={it.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle
                    className={`size-4 ${it.severity === "hard" ? "text-red-500" : "text-amber-500"}`}
                  />
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      it.severity === "hard"
                        ? "bg-red-500/15 text-red-700"
                        : "bg-amber-500/15 text-amber-700"
                    }`}
                  >
                    {it.severity === "hard" ? "Contradição" : "Atenção"}
                  </span>
                  <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-xs text-zinc-600">
                    {TYPE_LABEL[it.type] ?? it.type}
                  </span>
                  {it.chapter && (
                    <span className="text-xs text-muted-foreground">
                      cap. {it.chapter}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm">{it.description}</p>
                {it.conflictsWith && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Conflita com: {it.conflictsWith}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {it.severity === "hard" && it.chapter && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === it.id}
                      onClick={() => act(it.id, correctPassage)}
                      title="Regenera o capítulo corrigindo o conflito (salva uma versão antes)"
                    >
                      {busyId === it.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Wrench className="size-4" />
                      )}
                      Corrigir trecho
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === it.id}
                    onClick={() => act(it.id, resolveIssue)}
                  >
                    <Check className="size-4" />
                    Resolver
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === it.id}
                    onClick={() => act(it.id, ignoreIssue)}
                  >
                    <X className="size-4" />
                    Ignorar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Fios de trama */}
      {threads.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-medium">
            <GitBranch className="size-4 text-indigo-500" /> Fios de trama
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {threads.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    t.status === "open"
                      ? "bg-amber-500/15 text-amber-700"
                      : "bg-emerald-500/15 text-emerald-700"
                  }`}
                >
                  {t.status === "open" ? "aberto" : "fechado"}
                </span>
                <span className="flex-1">{t.description}</span>
                <span className="text-xs text-muted-foreground">
                  cap. {t.openedInChapter}
                  {t.closedInChapter ? `→${t.closedInChapter}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline (tempo da história) */}
      {timeline.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-medium">
            <Clock className="size-4 text-indigo-500" /> Linha do tempo
          </h2>
          <ol className="mt-3 border-l pl-4">
            {timeline.map((e) => (
              <li key={e.id} className="relative mb-4">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-indigo-500" />
                <div className="text-sm">{e.description}</div>
                <div className="text-xs text-muted-foreground">
                  {e.storyTime ? `${e.storyTime} · ` : ""}
                  {e.chapterRef ? `narrado no cap. ${e.chapterRef}` : ""}
                  {e.participants.length ? ` · ${e.participants.join(", ")}` : ""}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
