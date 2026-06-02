"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Sparkles, Coins, Loader2, BookOpen } from "lucide-react";

import { textToDoc, wordCount } from "@/lib/tiptap";
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
  const [balance, setBalance] = useState(initialBalance);
  const [message, setMessage] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    editable: false,
    immediatelyRender: false,
    content: initialChapters[0]
      ? textToDoc(initialChapters[0].contentText)
      : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none font-serif leading-relaxed focus:outline-none",
      },
    },
  });

  // Mostra o capítulo ativo no editor (quando não está gerando).
  useEffect(() => {
    if (!editor || generating || !activeId) return;
    const ch = chapters.find((c) => c.id === activeId);
    if (ch) editor.commands.setContent(textToDoc(ch.contentText), false);
  }, [activeId, editor, generating, chapters]);

  const totalWords =
    chapters.reduce((acc, c) => acc + wordCount(c.contentText), 0);
  const targetWords = pageTarget * 280;
  const targetReached = targetWords > 0 && totalWords >= targetWords;

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  async function generate() {
    if (!editor) return;
    setGenerating(true);
    setMessage(null);
    setInsufficient(false);
    setActiveId(null);
    editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });

      if (res.status === 402) {
        setInsufficient(true);
        setGenerating(false);
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Não foi possível gerar o capítulo.");
        setGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          let evt: {
            type: string;
            text?: string;
            chapterId?: string;
            index?: number;
            title?: string;
            balance?: number;
            targetReached?: boolean;
            message?: string;
          };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }

          if (evt.type === "delta" && evt.text) {
            fullText += evt.text;
            editor.commands.setContent(textToDoc(fullText), false);
            scrollToBottom();
          } else if (evt.type === "done") {
            const newChapter: Chapter = {
              id: evt.chapterId!,
              index: evt.index ?? chapters.length + 1,
              title: evt.title ?? `Capítulo ${chapters.length + 1}`,
              contentText: fullText,
            };
            setChapters((prev) => [...prev, newChapter]);
            setActiveId(newChapter.id);
            if (typeof evt.balance === "number") setBalance(evt.balance);
            if (evt.targetReached) {
              setMessage("Meta de páginas atingida — hora de revisar.");
            }
          } else if (evt.type === "error") {
            setMessage(evt.message ?? "Falha na geração.");
          }
        }
      }
    } catch {
      setMessage("Falha de conexão durante a geração.");
    } finally {
      setGenerating(false);
    }
  }

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
              disabled={generating}
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
        <header className="flex items-center justify-between gap-3 border-b px-6 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
            <Coins className="size-4 text-amber-500" />
            {balance.toLocaleString("pt-BR")}
          </span>
          <Button onClick={generate} disabled={generating}>
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generating
              ? "Escrevendo..."
              : chapters.length === 0
                ? "Gerar primeiro capítulo"
                : "Gerar próximo capítulo"}
          </Button>
        </header>

        {(message || insufficient) && (
          <div className="border-b bg-secondary/50 px-6 py-2 text-sm">
            {insufficient ? (
              <span>
                Créditos insuficientes.{" "}
                <Link
                  href="/dashboard/creditos"
                  className="link-underline font-medium"
                >
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
            {generating && (
              <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-indigo-500 align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
