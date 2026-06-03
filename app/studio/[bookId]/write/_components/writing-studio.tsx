"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import {
  Sparkles,
  Coins,
  Loader2,
  BookOpen,
  Wand2,
  Save,
  RotateCcw,
  ArrowRight,
  ImageIcon,
  Eraser,
  ChevronRight,
  ChevronDown,
  FileText,
  Check,
  Trash2,
  Plus,
} from "lucide-react";

import { textToDoc, docToText, wordCount } from "@/lib/tiptap";
import { paginateBook, totalBodyPages, type ChapterPage } from "@/lib/pagination";
import { saveDraft, loadDraft, clearDraft, type Draft } from "@/lib/draft";
import {
  saveChapter,
  normalizeChapter,
  createEmptyChapter,
  deleteChapter,
} from "../actions";
import { Button } from "@/components/ui/button";

type Chapter = {
  id: string;
  index: number;
  title: string;
  contentText: string;
};

/**
 * Remove os parágrafos que compõem a "linha" (página) `i` de um capítulo.
 * As quebras de página caem em fronteiras de parágrafo, então a contagem de
 * palavras aqui espelha exatamente a de `splitChapter` (paginação).
 */
function removePageParagraphs(
  text: string,
  pages: ChapterPage[],
  i: number
): string {
  const wordStart = pages[i]?.wordStart ?? 0;
  const wordEnd = i + 1 < pages.length ? pages[i + 1].wordStart : Infinity;
  const paras = (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  let cum = 0;
  const kept: string[] = [];
  for (const para of paras) {
    const w = para.split(/\s+/).length;
    const cumBefore = cum;
    cum += w;
    if (cumBefore >= wordStart && cumBefore < wordEnd) continue; // pertence à página → remove
    kept.push(para);
  }
  return kept.join("\n\n").trim();
}

export function WritingStudio({
  bookId,
  title,
  pageTarget,
  initialBalance,
  initialChapters,
  wordsPerPage,
  frontMatterPages,
  paragraphStyle,
  structure,
}: {
  bookId: string;
  title: string;
  pageTarget: number;
  initialBalance: number;
  initialChapters: Chapter[];
  wordsPerPage: number;
  frontMatterPages: number;
  paragraphStyle: "indent" | "spaced";
  structure: {
    cover: boolean;
    dedication: boolean;
    epigraph: boolean;
    preface: boolean;
    aboutAuthor: boolean;
    acknowledgments: boolean;
    glossary: boolean;
  };
}) {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [activeId, setActiveId] = useState<string | null>(
    initialChapters[0]?.id ?? null
  );
  const [expandedId, setExpandedId] = useState<string | null>(
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
  const [illustrating, setIllustrating] = useState(false);
  const [normalizingDoc, setNormalizingDoc] = useState(false);
  const [creating, setCreating] = useState(false);

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

  // Tipografia de parágrafo do editor conforme o Perfil de Layout:
  // ficção = recuo na 1ª linha sem espaço entre parágrafos; não-ficção = espaço
  // entre parágrafos sem recuo (o 1º parágrafo nunca recua).
  const paraClass =
    paragraphStyle === "spaced"
      ? "[&_p]:my-0 [&_p]:mb-4 [&_p]:[text-indent:0]"
      : "[&_p]:my-0 [&_p]:[text-indent:1.6em] [&_p:first-child]:[text-indent:0] [&_p.scene]:[text-indent:0]";
  const proseClass = `prose prose-zinc max-w-none font-serif leading-relaxed focus:outline-none min-h-[60vh] [&_h2]:mt-6 [&_h2]:mb-2 [&_img]:mx-auto [&_img]:my-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg ${paraClass}`;

  const editor = useEditor({
    extensions: [StarterKit, Image.configure({ inline: false }), Highlight],
    editable: true,
    immediatelyRender: false,
    content: initialChapters[0]
      ? textToDoc(initialChapters[0].contentText)
      : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class: proseClass,
      },
    },
    onUpdate: ({ editor }) => {
      const id = activeIdRef.current;
      if (!id) return;
      setDirty(true);
      const json = editor.getJSON();
      const text = docToText(editor.getJSON());
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

  // Páginas derivadas (recalcula ao gerar/editar → "vira a página" sozinho).
  const pagination = useMemo(
    () => paginateBook(chapters, wordsPerPage, frontMatterPages),
    [chapters, wordsPerPage, frontMatterPages]
  );
  const bookPages = totalBodyPages(pagination);

  function goToPage(chapterId: string, wordStart: number) {
    if (chapterId !== activeIdRef.current) setActiveId(chapterId);
    const ch = chaptersRef.current.find((c) => c.id === chapterId);
    const total = ch ? wordCount(ch.contentText) : 0;
    setTimeout(() => {
      const el = scrollRef.current;
      if (!el || !total) return;
      const frac = Math.min(0.98, wordStart / total);
      el.scrollTop = frac * Math.max(0, el.scrollHeight - el.clientHeight);
    }, 60);
  }

  // Cria um capítulo VAZIO (sem geração por IA). O conteúdo é escrito à mão ou
  // gerado depois com "Continuar geração".
  async function createNewChapter() {
    if (busy || creating) return;
    setCreating(true);
    setMessage(null);
    setInsufficient(false);
    try {
      const res = await createEmptyChapter(bookId);
      if (res && "error" in res && res.error) {
        setMessage(res.error);
        return;
      }
      if (res && "ok" in res && res.ok && res.chapter) {
        const ch = res.chapter as Chapter;
        setChapters((prev) => [...prev, ch]);
        setActiveId(ch.id);
        setExpandedId(ch.id);
        setRecovery(null);
        editor?.commands.setContent(
          { type: "doc", content: [{ type: "paragraph" }] },
          false
        );
        setDirty(false);
      }
    } catch {
      setMessage("Falha ao criar o capítulo.");
    } finally {
      setCreating(false);
    }
  }

  // Apaga o capítulo inteiro (todo o conteúdo é perdido), com confirmação.
  async function removeChapter(chapterId: string) {
    if (busy) return;
    if (!window.confirm("Você tem certeza de que deseja deletar esse capítulo?"))
      return;
    const res = await deleteChapter(bookId, chapterId);
    if (res && "error" in res && res.error) {
      setMessage(res.error);
      return;
    }
    clearDraft(chapterId);
    const remaining = chaptersRef.current.filter((c) => c.id !== chapterId);
    setChapters(remaining);
    if (activeIdRef.current === chapterId) {
      const next = remaining[0]?.id ?? null;
      setActiveId(next);
      if (!next) {
        editor?.commands.setContent(
          { type: "doc", content: [{ type: "paragraph" }] },
          false
        );
      }
    }
  }

  // Apaga uma "linha" (página) do capítulo: remove os parágrafos dela e
  // dispara o auto-save (persiste o capítulo modificado).
  function removePage(chapterId: string, pageIndex: number) {
    if (busy || !editor) return;
    if (!window.confirm("Você tem certeza de que quer deletar essa linha?"))
      return;
    const ch = chaptersRef.current.find((c) => c.id === chapterId);
    if (!ch) return;
    const pages = pagination[chapterId]?.pages ?? [];
    const newText = removePageParagraphs(ch.contentText, pages, pageIndex);

    setChapters((prev) =>
      prev.map((c) => (c.id === chapterId ? { ...c, contentText: newText } : c))
    );
    if (chapterId === activeIdRef.current) {
      editor.commands.setContent(textToDoc(newText), false);
    }
    setDirty(true);
    // Auto-save imediato das modificações.
    void persist(chapterId, textToDoc(newText), newText);
  }

  // Estrutura editorial: pré-textuais (antes) e pós-textuais (depois).
  type MItem = { label: string; seg?: string; filled: boolean; auto?: boolean };
  const frontMatter: MItem[] = [
    { label: "Capa", seg: "cover", filled: structure.cover },
    { label: "Folha de rosto", filled: true, auto: true },
    { label: "Créditos / Copyright", filled: true, auto: true },
    { label: "Dedicatória", seg: "matter", filled: structure.dedication },
    { label: "Epígrafe", seg: "matter", filled: structure.epigraph },
    { label: "Prefácio", seg: "matter", filled: structure.preface },
    { label: "Sumário", filled: true, auto: true },
  ];
  const backMatter: MItem[] = [
    { label: "Sobre o autor", seg: "matter", filled: structure.aboutAuthor },
    { label: "Agradecimentos", seg: "matter", filled: structure.acknowledgments },
    { label: "Glossário", seg: "prompt", filled: structure.glossary },
    { label: "Aviso de IA", filled: true, auto: true },
  ];

  function matterRow(it: MItem) {
    const inner = (
      <span className="flex items-center gap-1.5 px-2 py-1 text-xs">
        {it.filled ? (
          <Check className="size-3 shrink-0 text-emerald-500" />
        ) : (
          <span className="size-1.5 shrink-0 rounded-full border border-current/40" />
        )}
        <span className="truncate">{it.label}</span>
        {it.auto && <span className="ml-auto text-[10px] opacity-40">auto</span>}
      </span>
    );
    return it.seg ? (
      <Link
        key={it.label}
        href={`/studio/${bookId}/${it.seg}`}
        className="block rounded text-foreground hover:bg-accent hover:text-indigo-700"
      >
        {inner}
      </Link>
    ) : (
      <div key={it.label} className="block rounded text-foreground/60" title="Gerado automaticamente">
        {inner}
      </div>
    );
  }

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  function handleSaveClick() {
    if (!editor || !activeIdRef.current) return;
    void persist(
      activeIdRef.current,
      editor.getJSON(),
      docToText(editor.getJSON())
    );
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
    const baseText = docToText(editor.getJSON());
    const activeIndex = chaptersRef.current.find((c) => c.id === id)?.index;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          mode: "continue",
          chapterId: id,
          fullText: baseText,
          context: baseText.slice(-3000),
          index: activeIndex,
        }),
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
      let serverText: string | null = null;
      await readSSE(
        res,
        (text) => {
          added += text;
          editor.commands.setContent(
            textToDoc((baseText ? baseText + "\n\n" : "") + added),
            false
          );
          scrollToBottom();
        },
        (evt) => {
          if (typeof evt.balance === "number") setBalance(evt.balance);
          // O servidor concatena, normaliza, indexa (RAG) e salva o capítulo.
          if (typeof evt.contentText === "string") serverText = evt.contentText;
          if (evt.targetReached) setMessage("Meta de páginas atingida — hora de revisar.");
        }
      );
      if (serverText) {
        // Sincroniza com o texto salvo pelo servidor (motor de consistência).
        const synced: string = serverText;
        editor.commands.setContent(textToDoc(synced), false);
        setChapters((prev) =>
          prev.map((c) => (c.id === id ? { ...c, contentText: synced } : c))
        );
        setDirty(false);
        setLastSaved(Date.now());
        clearDraft(id);
      } else if (added.trim()) {
        // Fallback: salva pelo cliente caso o servidor não tenha persistido.
        const finalText = (baseText ? baseText + "\n\n" : "") + added;
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
      let insertedFrom = from;
      // Reabilita edição programática durante o stream.
      editor.setEditable(true);
      await readSSE(
        res,
        (text) => {
          if (first) {
            editor.chain().focus().deleteRange({ from, to }).run();
            insertedFrom = editor.state.selection.from;
            first = false;
          }
          editor.commands.insertContent(text);
          // Acompanha o trecho sendo reescrito (NÃO rola pro fim do documento).
          editor.commands.scrollIntoView();
        },
        (evt) => {
          // Substitui o trecho cru pelo texto normalizado (tipografia PT-BR).
          if (typeof evt.text === "string" && evt.text.trim()) {
            const insertedTo = editor.state.selection.from;
            editor
              .chain()
              .focus()
              .deleteRange({ from: insertedFrom, to: insertedTo })
              .insertContent(evt.text)
              .run();
          }
          if (typeof evt.balance === "number") setBalance(evt.balance);
          // Realça as palavras alteradas com fade lento, depois remove.
          // Mantém a tela SOBRE o trecho humanizado (rola o início da mudança
          // para a vista), em vez de pular para o fim do documento.
          const hlTo = editor.state.selection.from;
          if (hlTo > insertedFrom) {
            editor
              .chain()
              .setTextSelection({ from: insertedFrom, to: hlTo })
              .setHighlight()
              .setTextSelection(insertedFrom)
              .scrollIntoView()
              .run();
            const lo = insertedFrom;
            const hi = hlTo;
            setTimeout(() => {
              if (!editor || editor.isDestroyed) return;
              editor
                .chain()
                .setTextSelection({ from: lo, to: hi })
                .unsetHighlight()
                .setTextSelection(hi)
                .run();
            }, 3600);
          }
        }
      );
      // Persiste o resultado humanizado.
      const id = activeIdRef.current;
      if (id) {
        setDirty(true);
        void persist(id, editor.getJSON(), docToText(editor.getJSON()));
      }
    } catch {
      setMessage("Falha de conexão ao humanizar.");
    } finally {
      setHumanizing(false);
    }
  }

  async function illustrate() {
    if (!editor || !activeIdRef.current) return;
    const id = activeIdRef.current;

    // Prompt = seleção; sem seleção, o parágrafo onde está o cursor.
    const sel = editor.state.selection;
    const hasSel = sel.from !== sel.to;
    const $pos = editor.state.doc.resolve(hasSel ? sel.to : sel.from);
    const prompt = (
      hasSel
        ? editor.state.doc.textBetween(sel.from, sel.to, " ")
        : editor.state.doc.textBetween($pos.start(), $pos.end(), " ")
    )
      .trim()
      .slice(0, 600);
    if (!prompt) {
      setMessage("Selecione um trecho (ou posicione o cursor num parágrafo) para ilustrar.");
      return;
    }
    // Posição logo APÓS o bloco do trecho (a imagem entra inteira, sem partir o parágrafo).
    const insertAt = $pos.depth >= 1 ? $pos.after($pos.depth) : sel.to;

    setIllustrating(true);
    setMessage(null);
    setInsufficient(false);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, chapterId: id, prompt }),
      });
      if (res.status === 402) {
        setInsufficient(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setMessage(data.error ?? "Não foi possível ilustrar.");
        return;
      }
      editor
        .chain()
        .focus()
        .insertContentAt(insertAt, {
          type: "image",
          attrs: { src: data.url, alt: prompt.slice(0, 80) },
        })
        .run();
      if (typeof data.balance === "number") setBalance(data.balance);
      setDirty(true);
      void persist(id, editor.getJSON(), docToText(editor.getJSON()));
    } catch {
      setMessage("Falha de conexão ao ilustrar.");
    } finally {
      setIllustrating(false);
    }
  }

  async function normalizeDoc() {
    if (!editor || !activeIdRef.current) return;
    const id = activeIdRef.current;
    const text = docToText(editor.getJSON());
    if (!text.trim()) return;
    setNormalizingDoc(true);
    setMessage(null);
    try {
      const res = await normalizeChapter(bookId, id, text);
      if (res && "ok" in res && res.ok && typeof res.contentText === "string") {
        editor.commands.setContent(textToDoc(res.contentText), false);
        setChapters((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, contentText: res.contentText as string } : c
          )
        );
        setDirty(false);
        setLastSaved(Date.now());
        clearDraft(id);
        setMessage("Tipografia normalizada (aspas curvas, travessão, reticências).");
      } else if (res && "error" in res && res.error) {
        setMessage(res.error);
      }
    } catch {
      setMessage("Falha ao normalizar o capítulo.");
    } finally {
      setNormalizingDoc(false);
    }
  }

  const busy =
    generating || humanizing || illustrating || normalizingDoc || creating;

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Lista de capítulos */}
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
          <BookOpen className="size-4 text-indigo-500" />
          <span className="truncate">{title}</span>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
            Pré-textual
          </p>
          {frontMatter.map(matterRow)}

          <p className="px-2 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
            Miolo
          </p>
          {chapters.length === 0 && (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              Nenhum capítulo ainda. Gere o primeiro.
            </p>
          )}
          {chapters.map((c) => {
            const pages = pagination[c.id]?.pages ?? [];
            const open = expandedId === c.id;
            return (
              <div key={c.id}>
                <div
                  className={`group/ch flex w-full items-center gap-1 rounded-md px-1 py-1.5 text-sm ${
                    activeId === c.id
                      ? "bg-indigo-500/15 text-indigo-700"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : c.id)}
                    className="shrink-0 rounded p-0.5 hover:bg-black/5"
                    aria-label={open ? "Recolher" : "Expandir"}
                  >
                    {open ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(c.id);
                      setExpandedId(c.id);
                    }}
                    disabled={busy}
                    className="min-w-0 flex-1 truncate text-left"
                  >
                    {c.title}{" "}
                    <span className="text-xs opacity-60">({pages.length}p)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeChapter(c.id)}
                    disabled={busy}
                    title="Deletar capítulo (todo o conteúdo será perdido)"
                    aria-label="Deletar capítulo"
                    className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 group-hover/ch:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {open && pages.length > 0 && (
                  <div className="ml-4 flex flex-col border-l pl-2">
                    {pages.map((pg, i) => (
                      <div
                        key={i}
                        className="group/pg flex items-center gap-1 rounded hover:bg-accent"
                      >
                        <button
                          type="button"
                          onClick={() => goToPage(c.id, pg.wordStart)}
                          disabled={busy}
                          title={pg.preview}
                          className="flex min-w-0 flex-1 items-center gap-1.5 truncate px-1.5 py-1 text-left text-xs text-foreground/80 hover:text-indigo-700"
                        >
                          <FileText className="size-3 shrink-0 opacity-60" />
                          <span className="w-8 shrink-0 tabular-nums opacity-70">
                            {pg.displayNumber ?? "·"}
                          </span>
                          <span className="truncate opacity-80">{pg.preview || "—"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removePage(c.id, i)}
                          disabled={busy}
                          title="Deletar linha (o conteúdo dessa página será perdido)"
                          aria-label="Deletar linha"
                          className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 group-hover/pg:opacity-100"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <p className="px-2 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
            Pós-textual
          </p>
          {backMatter.map(matterRow)}
        </div>
        <div className="border-t p-3 text-xs text-muted-foreground">
          {totalWords.toLocaleString("pt-BR")} palavras · {bookPages}{" "}
          {bookPages === 1 ? "página" : "páginas"}
          {targetWords > 0 && ` · meta ${(targetWords / 280).toFixed(0)} págs`}
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
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Gerar */}
            <Button
              onClick={createNewChapter}
              disabled={busy || creating}
              title="Cria um capítulo vazio (sem gerar texto). Use 'Continuar geração' para escrever com IA."
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {chapters.length === 0 ? "Criar 1º capítulo" : "Novo capítulo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={continueChapter}
              disabled={busy || !activeId}
              title="Gera/continua o texto do capítulo aberto a partir de onde parou, dando sequência lógica ao contexto anterior"
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Continuar geração
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={illustrate}
              disabled={busy || !activeId}
              title="Selecione um trecho — a ilustração é criada a partir dele e entra logo após"
            >
              {illustrating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImageIcon className="size-4" />
              )}
              Ilustrar Seleção
            </Button>

            <span className="mx-1 h-5 w-px shrink-0 bg-border" />

            {/* Refinar */}
            <Button
              variant="outline"
              size="sm"
              onClick={humanize}
              disabled={busy || !activeId}
              title="Estilo da prosa: reescreve o trecho selecionado para soar mais humano (remove os 'AI tells')"
            >
              {humanizing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Humanizar Seleção
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={normalizeDoc}
              disabled={busy || !activeId}
              title="Caracteres tipográficos (não mexe no estilo): aspas curvas, travessão, reticências, espaços"
            >
              {normalizingDoc ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Eraser className="size-4" />
              )}
              Normalizar
            </Button>

            <span className="mx-1 h-5 w-px shrink-0 bg-border" />

            {/* Avançar */}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/studio/${bookId}/check`} title="Ir para a Revisão de consistência">
                Próximo: Revisão
                <ArrowRight className="size-4" />
              </Link>
            </Button>

            <span className="mx-1 h-5 w-px shrink-0 bg-border" />

            {/* Salvar — fixado no canto superior direito */}
            <Button
              onClick={handleSaveClick}
              disabled={busy || !activeId || saving}
              title="Salvar o capítulo agora (o histórico de versões fica na aba Versões)"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar
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
