"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, X, Check, Loader2 } from "lucide-react";

import { KEYWORD_CATEGORIES } from "@/lib/keywords";
import {
  LAYOUT_PROFILE_OPTIONS,
  defaultProfileIdForType,
} from "@/lib/layout/profile";
import { saveBrief, suggestFieldAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Selections = Record<string, string[]>;
type Editorial = {
  type: "fiction" | "nonfiction";
  logline: string;
  audience: string;
  pov: string;
  tone: string;
  structureMethod: string;
  layoutProfileId: string;
};

const POV_OPTIONS = [
  { v: "", l: "—" },
  { v: "first_past", l: "1ª pessoa, passado" },
  { v: "first_present", l: "1ª pessoa, presente" },
  { v: "third_past", l: "3ª pessoa, passado" },
  { v: "third_present", l: "3ª pessoa, presente" },
  { v: "omniscient", l: "Narrador onisciente" },
];

const STRUCTURE_OPTIONS = [
  { v: "", l: "—" },
  { v: "three_act", l: "3 atos (universal)" },
  { v: "hero_journey", l: "Jornada do Herói" },
  { v: "save_the_cat", l: "Save the Cat! (15 beats)" },
  { v: "story_circle", l: "Story Circle (Dan Harmon)" },
  { v: "nonfiction", l: "Não-ficção: Problema → Solução" },
];

export function PromptBuilder({
  bookId,
  initialTitle,
  initialSelections,
  initialEditorial,
  embedded = false,
}: {
  bookId: string;
  initialTitle: string;
  initialSelections: Selections;
  initialEditorial: Editorial;
  embedded?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [selections, setSelections] = useState<Selections>(initialSelections);
  const [editorial, setEditorial] = useState<Editorial>(initialEditorial);
  const [suggesting, setSuggesting] = useState<string | null>(null);

  function setEd<K extends keyof Editorial>(k: K, v: Editorial[K]) {
    setEditorial((e) => ({ ...e, [k]: v }));
    setSaved(false);
  }

  async function suggest(kind: "logline" | "audience" | "tone") {
    setSuggesting(kind);
    const res = await suggestFieldAction(bookId, kind);
    setSuggesting(null);
    if (res?.ok && res.text) setEd(kind, res.text);
  }
  const [suggestions, setSuggestions] = useState<Selections>({});
  const [loadingCat, setLoadingCat] = useState<string | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selected(cat: string): string[] {
    return selections[cat] ?? [];
  }

  function toggle(cat: string, value: string) {
    setSaved(false);
    setSelections((prev) => {
      const cur = prev[cat] ?? [];
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
      return { ...prev, [cat]: next };
    });
  }

  function addCustom(cat: string) {
    const v = (custom[cat] ?? "").trim();
    if (!v) return;
    if (!selected(cat).includes(v)) toggle(cat, v);
    setCustom((c) => ({ ...c, [cat]: "" }));
  }

  async function fetchSuggestions(cat: string) {
    setLoadingCat(cat);
    try {
      const context = [title, selections.genre?.[0], selections.theme?.[0]]
        .filter(Boolean)
        .join(", ");
      const res = await fetch("/api/keywords/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryKey: cat, context }),
      });
      const data = await res.json();
      setSuggestions((s) => ({ ...s, [cat]: data.suggestions ?? [] }));
    } catch {
      setSuggestions((s) => ({ ...s, [cat]: [] }));
    } finally {
      setLoadingCat(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveBrief(bookId, {
      title,
      selections,
      type: editorial.type,
      logline: editorial.logline,
      audience: editorial.audience,
      pov: editorial.pov,
      tone: editorial.tone,
      structureMethod: editorial.structureMethod,
      layoutProfileId:
        editorial.layoutProfileId || defaultProfileIdForType(editorial.type),
    });
    setSaving(false);
    if (result?.error) setError(result.error);
    else setSaved(true);
  }

  return (
    <div className={embedded ? "w-full" : "mx-auto w-full max-w-3xl px-6 py-8"}>
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">
          Base editorial
        </p>
        {!embedded && (
          <h1 className="mt-1 font-serif text-3xl font-semibold">A base do seu livro</h1>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          O DNA do livro: tudo aqui é injetado na geração. Use o ✨ para sugerir.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-2">
        <Label htmlFor="title">Título (provisório)</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
          placeholder="Ex.: A última carta"
        />
      </div>

      {/* Base editorial (camada de ofício) */}
      <section className="mb-10 flex flex-col gap-4 rounded-xl border p-5">
        <h2 className="font-medium">Base editorial</h2>

        <div className="flex gap-2">
          {(["fiction", "nonfiction"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEd("type", t)}
              className={`rounded-full border px-3 py-1 text-sm ${
                editorial.type === t
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "text-muted-foreground"
              }`}
            >
              {t === "fiction" ? "Ficção" : "Não-ficção"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="logline">
              {editorial.type === "fiction"
                ? "Promessa central (logline)"
                : "Transformação prometida"}
            </Label>
            <button
              type="button"
              onClick={() => suggest("logline")}
              disabled={suggesting === "logline"}
              className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
            >
              {suggesting === "logline" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              Sugerir
            </button>
          </div>
          <textarea
            id="logline"
            rows={2}
            value={editorial.logline}
            onChange={(e) => setEd("logline", e.target.value)}
            placeholder={
              editorial.type === "fiction"
                ? "Que pergunta o livro faz e por que virar a página?"
                : "Quem lê sai de X e chega em Y."
            }
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="audience">Público-alvo</Label>
              <button
                type="button"
                onClick={() => suggest("audience")}
                disabled={suggesting === "audience"}
                className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
              >
                {suggesting === "audience" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Sugerir
              </button>
            </div>
            <Input
              id="audience"
              value={editorial.audience}
              onChange={(e) => setEd("audience", e.target.value)}
              placeholder="Quem vai ler (e o nível)"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tone">Tom</Label>
              <button
                type="button"
                onClick={() => suggest("tone")}
                disabled={suggesting === "tone"}
                className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
              >
                {suggesting === "tone" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Sugerir
              </button>
            </div>
            <Input
              id="tone"
              value={editorial.tone}
              onChange={(e) => setEd("tone", e.target.value)}
              placeholder="sombrio, leve, lírico..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pov">POV</Label>
            <select
              id="pov"
              value={editorial.pov}
              onChange={(e) => setEd("pov", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {POV_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="structure">Método estrutural</Label>
            <select
              id="structure"
              value={editorial.structureMethod}
              onChange={(e) => setEd("structureMethod", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {STRUCTURE_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="layout">Perfil de diagramação (formato do livro)</Label>
          <select
            id="layout"
            value={editorial.layoutProfileId || defaultProfileIdForType(editorial.type)}
            onChange={(e) => setEd("layoutProfileId", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {LAYOUT_PROFILE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Define recuo/espaçamento, tipografia e formato (usado no EPUB e, depois,
            no PDF de impressão). Romance usa recuo na 1ª linha; não-ficção usa
            espaço entre parágrafos.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-8">
        {KEYWORD_CATEGORIES.map((cat) => (
          <section key={cat.key} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{cat.label}</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchSuggestions(cat.key)}
                disabled={loadingCat === cat.key}
              >
                {loadingCat === cat.key ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Sugerir
              </Button>
            </div>

            {/* Selecionadas */}
            {selected(cat.key).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected(cat.key).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggle(cat.key, v)}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-500 px-3 py-1 text-sm text-white"
                  >
                    {v}
                    <X className="size-3.5" />
                  </button>
                ))}
              </div>
            )}

            {/* Sugestões */}
            {(suggestions[cat.key] ?? []).filter(
              (v) => !selected(cat.key).includes(v)
            ).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(suggestions[cat.key] ?? [])
                  .filter((v) => !selected(cat.key).includes(v))
                  .map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggle(cat.key, v)}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:border-indigo-500/50 hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                      {v}
                    </button>
                  ))}
              </div>
            )}

            {/* Custom */}
            <div className="flex gap-2">
              <Input
                value={custom[cat.key] ?? ""}
                onChange={(e) =>
                  setCustom((c) => ({ ...c, [cat.key]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom(cat.key);
                  }
                }}
                placeholder={`Adicionar ${cat.label.toLowerCase()}...`}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => addCustom(cat.key)}
              >
                Adicionar
              </Button>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 flex items-center gap-3 border-t pt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar base"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-2 text-sm text-emerald-600">
            <Check className="size-4" />
            Base salva!
            <Link
              href={`/studio/${bookId}/write`}
              className="link-underline font-medium text-foreground"
            >
              Ir para a escrita →
            </Link>
          </span>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
        <Link
          href="/dashboard"
          className="link-underline ml-auto text-sm text-muted-foreground"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}
