"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";

import { assembleMatter, type Matter } from "@/lib/matter";
import { saveMatter } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AREA =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const FIELDS: { k: keyof Matter; l: string; area?: boolean; ph?: string }[] = [
  { k: "authorName", l: "Nome do autor" },
  { k: "dedication", l: "Dedicatória", area: true, ph: "Para..." },
  { k: "epigraph", l: "Epígrafe", area: true, ph: "Uma citação de abertura (opcional)" },
  { k: "preface", l: "Prefácio", area: true, ph: "Texto de abertura / apresentação (opcional)" },
  { k: "aboutAuthor", l: "Sobre o autor", area: true },
  { k: "acknowledgments", l: "Agradecimentos", area: true },
  { k: "cta", l: "Chamada final (CTA)", area: true, ph: "Convite para newsletter, próximo livro..." },
];

export function MatterEditor({
  bookId,
  bookTitle,
  chapters,
  initialMatter,
}: {
  bookId: string;
  bookTitle: string;
  chapters: { index: number; title: string }[];
  initialMatter: Matter;
}) {
  const [matter, setMatter] = useState<Matter>(initialMatter);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const year = new Date().getFullYear();
  const assembled = useMemo(
    () => assembleMatter({ title: bookTitle }, chapters, matter, year),
    [bookTitle, chapters, matter, year]
  );

  function set(k: keyof Matter, v: string) {
    setMatter((m) => ({ ...m, [k]: v }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await saveMatter(bookId, matter);
    setSaving(false);
    if (res?.ok) setSaved(true);
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-8 lg:grid-cols-2">
      {/* Formulário */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-indigo-500">
            <FileText className="size-4" /> Páginas do livro
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold">Front &amp; back matter</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Copyright, sumário e o aviso de IA são gerados automaticamente. Você
            preenche o resto.
          </p>
        </div>

        {FIELDS.map((f) => (
          <div key={f.k} className="flex flex-col gap-1.5">
            <Label htmlFor={f.k}>{f.l}</Label>
            {f.area ? (
              <textarea
                id={f.k}
                rows={2}
                value={matter[f.k] ?? ""}
                onChange={(e) => set(f.k, e.target.value)}
                placeholder={f.ph}
                className={AREA}
              />
            ) : (
              <Input
                id={f.k}
                value={matter[f.k] ?? ""}
                onChange={(e) => set(f.k, e.target.value)}
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar páginas"}
          </Button>
          {saved && <span className="text-sm text-emerald-600">Salvo!</span>}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Pré-visualização
        </h2>
        <div className="flex flex-col gap-5 font-serif">
          {[...assembled.front, ...assembled.back].map((s, i) => (
            <div key={i}>
              <p className="text-xs uppercase tracking-widest text-indigo-500">
                {s.title}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
