"use client";

import { useState } from "react";
import { X } from "lucide-react";

import {
  RadialOrbitalTimeline,
  type OrbitalNode,
} from "@/components/ui/radial-orbital-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RoadmapView({
  nodes: initialNodes,
  bookTitle,
  isDemo,
}: {
  nodes: OrbitalNode[];
  bookTitle: string;
  isDemo?: boolean;
}) {
  const [nodes, setNodes] = useState<OrbitalNode[]>(initialNodes);
  const [editing, setEditing] = useState<OrbitalNode | null>(null);
  const [draft, setDraft] = useState({ title: "", summary: "" });

  function openEdit(node: OrbitalNode) {
    setEditing(node);
    setDraft({ title: node.title, summary: node.summary });
  }

  function save() {
    if (!editing) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === editing.id
          ? { ...n, title: draft.title, summary: draft.summary }
          : n
      )
    );
    setEditing(null);
  }

  return (
    <div className="relative">
      <div className="px-6 pt-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">
          Mapa da história
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">{bookTitle}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Navegue pelos capítulos e beats. Clique em um ponto para ver as
          conexões e editar.
          {isDemo && " (demonstração com dados de exemplo)"}
        </p>
      </div>

      <RadialOrbitalTimeline
        nodes={nodes}
        centerLabel={bookTitle}
        onEdit={openEdit}
      />

      {/* Painel de edição (estado local; persistência real chega na Fase 7) */}
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
              <h2 className="font-semibold">Editar ponto</h2>
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
                <Label htmlFor="node-title">Título</Label>
                <Input
                  id="node-title"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="node-summary">Resumo</Label>
                <textarea
                  id="node-summary"
                  rows={4}
                  value={draft.summary}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, summary: e.target.value }))
                  }
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              {isDemo && (
                <p className="text-xs text-muted-foreground">
                  Modo demonstração: as edições ficam só nesta sessão. A
                  persistência (e regeneração de capítulos) chega na Fase 7.
                </p>
              )}
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
