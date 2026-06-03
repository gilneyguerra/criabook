"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, History } from "lucide-react";

import type { StudioProgress, StepKey } from "@/lib/studio/progress";

const STEPS: { key: StepKey; n: number; label: string; seg: string }[] = [
  { key: "base", n: 1, label: "Base & Bíblia", seg: "prompt" },
  { key: "cover", n: 2, label: "Capa", seg: "cover" },
  { key: "map", n: 3, label: "Mapa", seg: "roadmap" },
  { key: "write", n: 4, label: "Escrita", seg: "write" },
  { key: "review", n: 5, label: "Revisão", seg: "check" },
  { key: "pages", n: 6, label: "Páginas", seg: "matter" },
  { key: "export", n: 7, label: "Exportar", seg: "export" },
];

export function StudioNav({
  bookId,
  progress,
}: {
  bookId: string;
  progress: StudioProgress;
}) {
  const pathname = usePathname();
  const base = `/studio/${bookId}`;
  const activeSeg = pathname.replace(base, "").split("/").filter(Boolean)[0] ?? "";

  return (
    <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
      {STEPS.map((s) => {
        const active = activeSeg === s.seg;
        const done = progress[s.key];
        return (
          <Link
            key={s.key}
            href={`${base}/${s.seg}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
              active
                ? "bg-indigo-500/12 text-indigo-700"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-indigo-500 text-white"
                    : "border border-current/30 text-current"
              }`}
            >
              {done ? <Check className="size-3" /> : s.n}
            </span>
            <span className="whitespace-nowrap">{s.label}</span>
          </Link>
        );
      })}

      <span className="mx-1 h-5 w-px shrink-0 bg-border" />

      <Link
        href={`${base}/versions`}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 ${
          activeSeg === "versions"
            ? "bg-indigo-500/12 text-indigo-700"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        title="Histórico e rollback (disponível em qualquer etapa)"
      >
        <History className="size-4" />
        <span className="whitespace-nowrap">Versões</span>
      </Link>
    </nav>
  );
}
