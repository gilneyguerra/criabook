"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, BookText, Sparkles, Loader2 } from "lucide-react";

import { addBibleEntry, removeBibleEntryAction } from "../actions";
import { generateBibleSection } from "@/app/studio/[bookId]/prompt/actions";
import type { BibleType } from "@/lib/db/queries";
import type { BibleSection } from "@/lib/ai/claude";
import { AiErrorText } from "@/components/ai-error-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = { id: string } & Record<string, unknown>;
type Bible = {
  characters: Row[];
  locations: Row[];
  worldRules: Row[];
  timeline: Row[];
  glossary: Row[];
};

type Field = { k: string; l: string; area?: boolean };
type Section = {
  type: BibleType;
  key: keyof Bible;
  label: string;
  primary: string;
  secondary?: string;
  fields: Field[];
};

const SECTIONS: Section[] = [
  {
    type: "character",
    key: "characters",
    label: "Personagens",
    primary: "name",
    secondary: "role",
    fields: [
      { k: "name", l: "Nome" },
      { k: "role", l: "Papel" },
      { k: "appearance", l: "Aparência", area: true },
      { k: "traits", l: "Traços", area: true },
      { k: "arc", l: "Arco", area: true },
    ],
  },
  {
    type: "location",
    key: "locations",
    label: "Locais",
    primary: "name",
    secondary: "description",
    fields: [
      { k: "name", l: "Nome" },
      { k: "description", l: "Descrição", area: true },
    ],
  },
  {
    type: "world_rule",
    key: "worldRules",
    label: "Regras do mundo",
    primary: "rule",
    secondary: "category",
    fields: [
      { k: "category", l: "Categoria" },
      { k: "rule", l: "Regra", area: true },
    ],
  },
  {
    type: "timeline",
    key: "timeline",
    label: "Linha do tempo",
    primary: "description",
    secondary: "order",
    fields: [
      { k: "order", l: "Ordem" },
      { k: "description", l: "Evento", area: true },
    ],
  },
  {
    type: "glossary",
    key: "glossary",
    label: "Glossário",
    primary: "term",
    secondary: "definition",
    fields: [
      { k: "term", l: "Termo" },
      { k: "definition", l: "Definição", area: true },
    ],
  },
];

// Seções que a IA sabe gerar (glossário fica de fora do gerador).
const AI_SECTIONS = new Set<BibleType>([
  "character",
  "location",
  "world_rule",
  "timeline",
]);

export function BibleManager({
  bookId,
  bookTitle,
  bible,
  embedded = false,
}: {
  bookId: string;
  bookTitle: string;
  bible: Bible;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [genSection, setGenSection] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  function setField(type: string, k: string, v: string) {
    setForms((f) => ({ ...f, [type]: { ...(f[type] ?? {}), [k]: v } }));
  }

  async function generate(type: BibleType) {
    setGenSection(type);
    setAiError(null);
    const res = await generateBibleSection(bookId, type as BibleSection);
    setGenSection(null);
    if (res?.ok) router.refresh();
    else if (res?.error) setAiError(res.error);
  }

  async function add(section: Section) {
    const data = forms[section.type] ?? {};
    const primaryVal = (data[section.primary] ?? "").trim();
    if (!primaryVal) return;
    setPending(section.type);
    const res = await addBibleEntry(bookId, section.type, data);
    setPending(null);
    if (res?.ok) {
      setForms((f) => ({ ...f, [section.type]: {} }));
      router.refresh();
    }
  }

  async function remove(type: BibleType, id: string) {
    setPending(`${type}:${id}`);
    await removeBibleEntryAction(bookId, type, id);
    setPending(null);
    router.refresh();
  }

  return (
    <div className={embedded ? "w-full" : "mx-auto w-full max-w-3xl px-6 py-8"}>
      {aiError && (
        <p className="mb-4 rounded-md bg-secondary/60 px-3 py-2 text-sm text-destructive">
          <AiErrorText text={aiError} />
        </p>
      )}
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-indigo-500">
          <BookText className="size-4" /> Bíblia da história
        </p>
        {!embedded && (
          <h1 className="mt-1 font-serif text-3xl font-semibold">{bookTitle}</h1>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          A fonte única de verdade — injetada na geração para manter a consistência
          (cap. 8 lembra do cap. 2). Use o ✨ para gerar a partir da base.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {SECTIONS.map((section) => {
          const rows = bible[section.key];
          const data = forms[section.type] ?? {};
          return (
            <section key={section.type} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">
                  {section.label}{" "}
                  <span className="text-muted-foreground">({rows.length})</span>
                </h2>
                {AI_SECTIONS.has(section.type) && (
                  <button
                    type="button"
                    onClick={() => generate(section.type)}
                    disabled={genSection === section.type}
                    className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
                  >
                    {genSection === section.type ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Sparkles className="size-3" />
                    )}
                    Gerar
                  </button>
                )}
              </div>

              {rows.length > 0 && (
                <ul className="flex flex-col divide-y rounded-lg border">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-start justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {String(row[section.primary] ?? "")}
                        </p>
                        {section.secondary && row[section.secondary] ? (
                          <p className="truncate text-sm text-muted-foreground">
                            {String(row[section.secondary])}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(section.type, row.id)}
                        disabled={pending === `${section.type}:${row.id}`}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div
                    key={field.k}
                    className={`flex flex-col gap-1 ${field.area ? "sm:col-span-2" : ""}`}
                  >
                    <Label htmlFor={`${section.type}-${field.k}`} className="text-xs">
                      {field.l}
                    </Label>
                    {field.area ? (
                      <textarea
                        id={`${section.type}-${field.k}`}
                        rows={2}
                        value={data[field.k] ?? ""}
                        onChange={(e) => setField(section.type, field.k, e.target.value)}
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      />
                    ) : (
                      <Input
                        id={`${section.type}-${field.k}`}
                        value={data[field.k] ?? ""}
                        onChange={(e) => setField(section.type, field.k, e.target.value)}
                      />
                    )}
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <Button
                    size="sm"
                    onClick={() => add(section)}
                    disabled={pending === section.type}
                  >
                    <Plus className="size-4" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
