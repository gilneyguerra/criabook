"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, X, Check, Loader2 } from "lucide-react";

import { KEYWORD_CATEGORIES } from "@/lib/keywords";
import { saveBrief } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Selections = Record<string, string[]>;

export function PromptBuilder({
  bookId,
  initialTitle,
  initialSelections,
}: {
  bookId: string;
  initialTitle: string;
  initialSelections: Selections;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [selections, setSelections] = useState<Selections>(initialSelections);
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
    const result = await saveBrief(bookId, { title, selections });
    setSaving(false);
    if (result?.error) setError(result.error);
    else setSaved(true);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">
          Construtor de prompt
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">A base do seu livro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Clique nas sugestões ou crie as suas. Isso vira a engenharia por trás
          da geração.
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
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
            <Check className="size-4" />
            Base salva! A geração de capítulos chega na Fase 4.
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
