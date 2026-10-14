"use client";

import { AiErrorText } from "@/components/ai-error-text";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Wand2 } from "lucide-react";

import { PromptBuilder } from "./prompt-builder";
import { BibleManager } from "../../bible/_components/bible-manager";
import { NextStep } from "../../_components/next-step";
import { generateWorld } from "../actions";
import { Button } from "@/components/ui/button";

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
type Row = { id: string } & Record<string, unknown>;
type Bible = {
  characters: Row[];
  locations: Row[];
  worldRules: Row[];
  timeline: Row[];
  glossary: Row[];
};

export function FoundationStudio({
  bookId,
  bookTitle,
  initialTitle,
  initialSelections,
  initialEditorial,
  bible,
}: {
  bookId: string;
  bookTitle: string;
  initialTitle: string;
  initialSelections: Selections;
  initialEditorial: Editorial;
  bible: Bible;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generateWorldNow() {
    setGenerating(true);
    setMessage(null);
    const res = await generateWorld(bookId);
    setGenerating(false);
    if (res?.ok) {
      setMessage(`Mundo gerado: ${res.count} itens adicionados à Bíblia.`);
      router.refresh();
    } else {
      setMessage(res?.error ?? "Não foi possível gerar o mundo.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">
            Passo 1 · Base & Bíblia
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold">{bookTitle}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Defina o DNA do livro (esquerda) e construa o mundo (direita). Tudo aqui
            é injetado na geração e no motor de consistência.
          </p>
        </div>
        <Button onClick={generateWorldNow} disabled={generating} title="Lê a base e propõe a Bíblia inteira">
          {generating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
          Gerar mundo a partir da base
        </Button>
      </div>

      {message && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-md bg-secondary/60 px-3 py-2 text-sm">
          <Sparkles className="size-4 text-indigo-500" />
          <AiErrorText text={message} />
        </p>
      )}

      <div className="grid gap-10 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <div className="min-w-0 rounded-xl border p-5">
          <PromptBuilder
            bookId={bookId}
            initialTitle={initialTitle}
            initialSelections={initialSelections}
            initialEditorial={initialEditorial}
            embedded
          />
        </div>
        <div className="min-w-0 rounded-xl border p-5">
          <BibleManager bookId={bookId} bookTitle={bookTitle} bible={bible} embedded />
        </div>
      </div>

      <div className="mt-8 flex justify-end border-t pt-6">
        <NextStep bookId={bookId} seg="cover" label="Capa" />
      </div>
    </div>
  );
}
