"use client";

import { useMemo, useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";

import {
  RadialOrbitalTimeline,
  type OrbitalNode,
} from "@/components/ui/radial-orbital-timeline";
import { generateStructureAction, saveBeatAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BeatRow = {
  id: string;
  order: number;
  title: string;
  summary: string;
  beatType: string;
};

const CLIMAX = new Set(["climax", "finale", "ordeal", "find", "all_is_lost"]);

function beatsToNodes(beats: BeatRow[]): OrbitalNode[] {
  const sorted = [...beats].sort((a, b) => a.order - b.order);
  return sorted.map((b, i) => ({
    id: b.id,
    title: b.title || `Beat ${i + 1}`,
    summary: b.summary,
    type: CLIMAX.has(b.beatType) ? "climax" : "beat",
    status: "draft",
    relatedIds: i < sorted.length - 1 ? [sorted[i + 1].id] : [],
  }));
}

export function RoadmapView({
  bookId,
  bookTitle,
  isDemo,
  initialBeats,
}: {
  bookId: string;
  bookTitle: string;
  isDemo: boolean;
  initialBeats: BeatRow[];
}) {
  const [beats, setBeats] = useState<BeatRow[]>(initialBeats);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrbitalNode | null>(null);
  const [draft, setDraft] = useState({ title: "", summary: "" });

  const nodes = useMemo(() => beatsToNodes(beats), [beats]);

  async function generate() {
    setGenerating(true);
    setMessage(null);
    const res = await generateStructureAction(bookId);
    setGenerating(false);
    if (res?.ok && res.beats) setBeats(res.beats);
    else setMessage(res?.error ?? "Falha ao gerar a estrutura.");
  }

  function openEdit(node: OrbitalNode) {
    setEditing(node);
    setDraft({ title: node.title, summary: node.summary });
  }

  async function save() {
    if (!editing) return;
    const id = editing.id;
    setBeats((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, title: draft.title, summary: draft.summary } : b
      )
    );
    setEditing(null);
    if (!isDemo) {
      await saveBeatAction(bookId, id, { title: draft.title, summary: draft.summary });
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-col items-center gap-3 px-6 pt-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">
          Mapa da história
        </p>
        <h1 className="font-serif text-3xl font-semibold md:text-4xl">{bookTitle}</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          A estrutura do livro em beats. Clique num ponto para ver conexões e
          editar.{isDemo && " (demonstração)"}
        </p>
        {!isDemo && (
          <Button onClick={generate} disabled={generating} variant="outline" size="sm">
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {beats.length ? "Regerar estrutura" : "Gerar estrutura"}
          </Button>
        )}
        {message && <p className="text-sm text-destructive">{message}</p>}
      </div>

      {nodes.length > 0 ? (
        <RadialOrbitalTimeline nodes={nodes} centerLabel={bookTitle} onEdit={openEdit} />
      ) : (
        <div className="flex h-[40vh] items-center justify-center px-6 text-center text-muted-foreground">
          {isDemo
            ? "Sem beats."
            : "Nenhum beat ainda. Clique em “Gerar estrutura” para criar os beats a partir do método estrutural escolhido na Base."}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Editar beat</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="beat-title">Título</Label>
                <Input
                  id="beat-title"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="beat-summary">Descrição</Label>
                <textarea
                  id="beat-summary"
                  rows={4}
                  value={draft.summary}
                  onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
