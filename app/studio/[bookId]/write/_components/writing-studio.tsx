"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Sparkles,
  Coins,
  Loader2,
  BookOpen,
  Wand2,
  Save,
  RotateCcw,
  PenLine,
  History,
  Download,
} from "lucide-react";

import { textToDoc, wordCount } from "@/lib/tiptap";
import { saveDraft, loadDraft, clearDraft, type Draft } from "@/lib/draft";
import { saveChapter, snapshotChapter } from "../actions";
import { Button } from "@/components/ui/button";

type Chapter = {
  id: string;
  index: number;
  title: string;
  contentText: string;
};

export function WritingStudio({
  bookId,
  title,
  pageTarget,
  initialBalance,
  initialChapters,
}: {
  bookId: string;
  title: string;
  pageTarget: number;
  initialBalance: number;
  initialChapters: Chapter[];
}) {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [activeId, setActiveId] = useState<string | null>(
    initialChapters[0]?.id ?? null
  );
  const [generating, setGenerating] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [balance, setBalance] = useState(initialBalance);
  const [message, setMessage] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [recovery, setRecovery] = useState<Draft | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(activeId);
  const chaptersRef = useRef<Chapter[]>(chapters);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  chaptersRef.current = chapters;

  const persist = useCallback(
    async (id: string, json: unknown, text: string) => {
      setSaving(true);
      const res = await saveChapter(id, { contentJson: json, contentText: text });
      setSaving(false);
      if (res && "ok" in res && res.ok) {
        setDirty(false);
        setLastSaved(Date.now());
        clearDraft(id);
        setChapters((prev) =>
          prev.map((c) => (c.id === id ? { ...c, contentText: text } : c))
        );
      } else if (res && "error" in res && res.error) {
        setMessage(res.error);
      }
    },
    []
  );

  const editor = useEditor({
    extensions: [StarterKit],
    editable: true,
    immediatelyRender: false,
    content: initialChapters[0]
      ? textToDoc(initialChapters[0].contentText)
      : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none font-serif leading-relaxed focus:outline-none min-h-[60vh]",
      },
    },
    onUpdate: ({ editor }) => {
      const id = activeIdRef.current;
      if (!id) return;
      setDirty(true);
      const json = editor.getJSON();
      const text = editor.getText({ blockSeparator: "\n\n" });
      saveDraft(id, { json, text, at: Date.now() });
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => void persist(id, json, text), 2500);
    },
  });

  // Mantém o editor não-editável durante streaming.
  useEffect(() => {
    editor?.setEditable(!generating && !humanizing);
  }, [editor, generating, humanizing]);

  // Troca de capítulo: carrega o conteúdo e checa rascunho de recuperação.
  useEffect(() => {
    activeIdRef.current = activeId;
    if (!editor || generating || humanizing || !activeId) return;
    const ch = chaptersRef.current.find((c) => c.id === activeId);
    if (!ch) return;
    editor.commands.setContent(textToDoc(ch.contentText), false);
    setDirty(false);

    const draft = loadDraft(activeId);
    if (draft && draft.text.trim() && draft.text !== ch.contentText) {
      setRecovery(draft);
    } else {
      setRecovery(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, editor]);

  // Aviso ao fechar a aba com alterações não salvas.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const totalWords = chapters.reduce((acc, c) => acc + wordCount(c.contentText), 0);
  const targetWords = pageTarget * 280;

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  function handleSaveClick() {
    if (!editor || !activeIdRef.current) return;
    void persist(
      activeIdRef.current,
      editor.getJSON(),
      editor.getText({ blockSeparator: "\n\n" })
    );
  }

  async function handleSnapshot() {
    if (!editor || !activeIdRef.current) return;
    setSaving(true);
    await snapshotChapter(bookId, activeIdRef.current, {
      contentJson: editor.getJSON(),
      contentText: editor.getText({ blockSeparator: "\n\n" }),
    });
    setSaving(false);
    setDirty(false);
    setLastSaved(Date.now());
    if (activeIdRef.current) clearDraft(activeIdRef.current);
  }

  function restore() {
    if (!editor || !recovery) return;
    editor.commands.setContent(textToDoc(recovery.text), false);
    setDirty(true);
    setRecovery(null);
  }

  function discardRecovery() {
    if (activeIdRef.current) clearDraft(activeIdRef.current);
    setRecovery(null);
  }

  async function readSSE(
    res: Response,
    onDelta: (text: string) => void,
    onDone: (evt: Record<string, unknown>) => void
  ) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.replace(/^data: /, "").trim();
        if (!line) continue;
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(line);
        } catch {
          continue;
        }
        if (evt.type === "delta" && typeof evt.text === "string") onDelta(evt.text);
        else if (evt.type === "done") onDone(evt);
        else if (evt.type === "error") setMessage(String(evt.message ?? "Falha."));
      }
    }
  }

  async function generate() {
    if (!editor) return;
    setGenerating(true);
    setMessage(null);
    setInsufficient(false);
    setActiveId(null);
    setRecovery(null);
    editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] }, false);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (res.status === 402) {
        setInsufficient(true);
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Não foi possível gerar o capítulo.");
        return;
      }

      let fullText = "";
      await readSSE(
        res,
        (text) => {
          fullText += text;
          editor.commands.setContent(textToDoc(fullText), false);
          scrollToBottom();
        },
        (evt) => {
          const newChapter: Chapter = {
            id: String(evt.chapterId),
            index: Number(evt.index ?? chapters.length + 1),
            title: String(evt.title ?? `Capítulo ${chapters.length + 1}`),
            contentText: fullText,
          };
          setChapters((prev) => [...prev, newChapter]);
          setActiveId(newChapter.id);
          if (typeof evt.balance === "number") setBalance(evt.balance);
          if (evt.targetReached) setMessage("Meta de páginas atingida — hora de revisar.");
        }
      );
    } catch {
      setMessage("Falha de conexão durante a geração.");
    } finally {
      setGenerating(false);
    }
  }

  async function continueChapter() {
    if (!editor) return;
    const id = activeIdRef.current;
    if (!id) {
      setMessage("Abra um capítulo para continuar.");
      return;
    }
    setGenerating(true);
    setMessage(null);
    setInsufficient(false);
    setRecovery(null);
    const baseText = editor.getText({ blockSeparator: "\n\n" });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, mode: "continue", context: baseText.slice(-3000) }),
      });
      if (res.status === 402) {
        setInsufficient(true);
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Não foi possível continuar o capítulo.");
        return;
      }

      let added = "";
      await readSSE(
        res,
        (text) => {
          added += text;
          editor.commands.setContent(textToDoc(baseText + "\n\n" + added), false);
          scrollToBottom();
        },
        (evt) => {
          if (typeof evt.balance === "number") setBalance(evt.balance);
        }
      );
      if (added.trim()) {
        const finalText = baseText + "\n\n" + added;
        void persist(id, editor.getJSON(), finalText);
      }
    } catch {
      setMessage("Falha de conexão durante a geração.");
    } finally {
      setGenerating(false);
    }
  }

  async function humanize() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      setMessage("Selecione um trecho para humanizar.");
      return;
    }
    const selected = editor.state.doc.textBetween(from, to, "\n");

    setHumanizing(true);
    setMessage(null);
    setInsufficient(false);
    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selected }),
      });
      if (res.status === 402) {
        setInsufficient(true);
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Não foi possível humanizar.");
        return;
      }

      let first = true;
      // Reabilita edição programática durante o stream.
      editor.setEditable(true);
      await readSSE(
        res,
        (text) => {
          if (first) {
            editor.chain().focus().deleteRange({ from, to }).run();
            first = false;
          }
          editor.commands.insertContent(text);
          scrollToBottom();
        },
        (evt) => {
          if (typeof evt.balance === "number") setBalance(evt.balance);
        }
      );
      // Persiste o resultado humanizado.
      const id = activeIdRef.current;
      if (id) {
        setDirty(true);
        void persist(id, editor.getJSON(), editor.getText({ blockSeparator: "\n\n" }));
      }
    } catch {
      setMessage("Falha de conexão ao humanizar.");
    } finally {
      setHumanizing(false);
    }
  }

  const busy = generating || humanizing;

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Lista de capítulos */}
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
          <BookOpen className="size-4 text-indigo-500" />
          <span className="truncate">{title}</span>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {chapters.length === 0 && (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Nenhum capítulo ainda. Gere o primeiro.
            </p>
          )}
          {chapters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              disabled={busy}
              className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
                activeId === c.id
                  ? "bg-indigo-500/15 text-indigo-700"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
        <div className="border-t p-3 text-xs text-muted-foreground">
          {totalWords.toLocaleString("pt-BR")} palavras
          {targetWords > 0 && ` / ${targetWords.toLocaleString("pt-BR")}`}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
              <Coins className="size-4 text-amber-500" />
              {balance.toLocaleString("pt-BR")}
            </span>
            <span className="text-muted-foreground">
              {saving
                ? "Salvando…"
                : dirty
                  ? "Alterações não salvas"
                  : lastSaved
                    ? `Salvo ${new Date(lastSaved).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={humanize}
              disabled={busy || !activeId}
              title="Selecione um trecho e clique para reescrever de forma mais humana"
            >
              {humanizing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Humanizar seleção
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveClick}
              disabled={busy || !activeId || saving}
            >
              <Save className="size-4" />
              Salvar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSnapshot}
              disabled={busy || !activeId || saving}
              title="Salva um ponto de versão restaurável"
            >
              <History className="size-4" />
              Versão
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={continueChapter}
              disabled={busy || !activeId}
              title="Gera mais texto dentro do capítulo aberto"
            >
              <PenLine className="size-4" />
              Continuar capítulo
            </Button>
            <Button onClick={generate} disabled={busy}>
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {chapters.length === 0 ? "Gerar 1º capítulo" : "Próximo capítulo"}
            </Button>
            <Button asChild variant="ghost" size="sm" disabled={chapters.length === 0}>
              <a href={`/api/export?bookId=${bookId}`} title="Baixar EPUB">
                <Download className="size-4" />
                EPUB
              </a>
            </Button>
          </div>
        </header>

        {recovery && (
          <div className="flex items-center gap-3 border-b bg-amber-50 px-6 py-2 text-sm text-amber-800">
            <RotateCcw className="size-4 shrink-0" />
            <span className="flex-1">
              Há alterações não salvas de{" "}
              {new Date(recovery.at).toLocaleString("pt-BR")}.
            </span>
            <button onClick={restore} className="font-medium underline underline-offset-2">
              Restaurar
            </button>
            <button onClick={discardRecovery} className="text-amber-700/70 hover:text-amber-900">
              Descartar
            </button>
          </div>
        )}

        {(message || insufficient) && (
          <div className="border-b bg-secondary/50 px-6 py-2 text-sm">
            {insufficient ? (
              <span>
                Créditos insuficientes.{" "}
                <Link href="/dashboard/creditos" className="link-underline font-medium">
                  Comprar créditos
                </Link>
              </span>
            ) : (
              message
            )}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div className="mx-auto max-w-2xl px-6 py-10">
            <EditorContent editor={editor} />
            {busy && (
              <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-indigo-500 align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
