"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Sparkles,
  Flame,
  Milestone,
  Pencil,
} from "lucide-react";

export type OrbitalNode = {
  id: string;
  title: string;
  summary: string;
  type: "beat" | "chapter" | "climax";
  status: "done" | "draft" | "pending";
  relatedIds: string[];
};

const TYPE_ICON = {
  beat: Milestone,
  chapter: BookOpen,
  climax: Flame,
} as const;

const STATUS_RING = {
  done: "border-emerald-400/70",
  draft: "border-amber-400/70",
  pending: "border-zinc-500/60",
} as const;

export function RadialOrbitalTimeline({
  nodes,
  centerLabel = "Livro",
  onEdit,
}: {
  nodes: OrbitalNode[];
  centerLabel?: string;
  onEdit?: (node: OrbitalNode) => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [radius, setRadius] = useState(210);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Raio e centro responsivos ao tamanho do contêiner.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      const min = Math.min(el.clientWidth, el.clientHeight);
      setRadius(Math.max(120, Math.min(240, min / 2 - 70)));
      setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rotação automática (pausa quando um nó está aberto / reduced-motion).
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced || activeId) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (last) setRotation((r) => (r + (t - last) * 0.006) % 360);
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeId]);

  const positioned = useMemo(() => {
    const total = nodes.length || 1;
    return nodes.map((node, i) => {
      const angle = (i / total) * 360 + rotation;
      const rad = (angle * Math.PI) / 180;
      const x = radius * Math.cos(rad);
      const y = radius * Math.sin(rad);
      const depth = Math.cos(rad); // -1 (atrás) .. 1 (frente)
      return { node, x, y, depth };
    });
  }, [nodes, rotation, radius]);

  const active = nodes.find((n) => n.id === activeId) ?? null;
  const relatedIds = new Set(active?.relatedIds ?? []);
  const posById = new Map(positioned.map((p) => [p.node.id, p]));

  return (
    <div
      ref={containerRef}
      className="relative mx-auto flex h-[560px] w-full max-w-3xl items-center justify-center overflow-hidden"
      onClick={() => setActiveId(null)}
    >
      {/* Linhas de conexão a partir do nó ativo */}
      {active && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {active.relatedIds.map((rid) => {
            const a = posById.get(active.id);
            const b = posById.get(rid);
            if (!a || !b) return null;
            const cx = size.w / 2;
            const cy = size.h / 2;
            return (
              <line
                key={rid}
                x1={cx + a.x}
                y1={cy + a.y}
                x2={cx + b.x}
                y2={cy + b.y}
                stroke="rgb(129 140 248)"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.6}
              />
            );
          })}
        </svg>
      )}

      {/* Núcleo central */}
      <div className="absolute z-10 flex size-24 flex-col items-center justify-center rounded-full border border-indigo-300/40 bg-gradient-to-b from-indigo-500/20 to-transparent text-center backdrop-blur">
        <Sparkles className="size-5 text-indigo-500" />
        <span className="mt-1 max-w-20 truncate px-1 text-xs font-medium">
          {centerLabel}
        </span>
      </div>

      {/* Nós em órbita */}
      {positioned.map(({ node, x, y, depth }) => {
        const Icon = TYPE_ICON[node.type];
        const isActive = node.id === activeId;
        const isRelated = relatedIds.has(node.id);
        const scale = 0.85 + (depth + 1) * 0.12;
        const dim = active && !isActive && !isRelated ? 0.35 : 1;

        return (
          <button
            key={node.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveId(isActive ? null : node.id);
            }}
            className="absolute left-1/2 top-1/2 flex flex-col items-center gap-1"
            style={{
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`,
              zIndex: isActive ? 30 : Math.round((depth + 1) * 10),
              opacity: dim,
              transition: "opacity 200ms ease",
            }}
          >
            <span
              className={`flex size-12 items-center justify-center rounded-full border-2 bg-background shadow-sm ${
                isActive
                  ? "border-indigo-500 ring-4 ring-indigo-500/20"
                  : STATUS_RING[node.status]
              } ${isRelated ? "ring-2 ring-indigo-400/40" : ""}`}
            >
              <Icon className="size-5 text-foreground/80" />
            </span>
            <span className="max-w-24 truncate text-center text-[11px] font-medium text-foreground/80">
              {node.title}
            </span>
          </button>
        );
      })}

      {/* Card do nó ativo */}
      {active && (
        <div
          className="absolute bottom-4 left-1/2 z-40 w-[min(92%,22rem)] -translate-x-1/2 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{active.title}</h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {active.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{active.summary}</p>
          <button
            type="button"
            onClick={() => onEdit?.(active)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
        </div>
      )}
    </div>
  );
}
