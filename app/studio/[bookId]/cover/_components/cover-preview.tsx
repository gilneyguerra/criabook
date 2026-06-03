"use client";

import { useEffect, useRef } from "react";

import { drawCover, W, H, type CoverConfig } from "@/lib/cover/compose";

type SocialItem = { quote: string; author: string };

export function CoverPreview({
  cfg,
  view,
  backText,
  socialProof,
  spineMm,
  target,
}: {
  cfg: CoverConfig;
  view: "front" | "back";
  backText?: string | null;
  socialProof?: SocialItem[];
  spineMm?: number | null;
  target: "ebook" | "print";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (view !== "front") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let alive = true;
    void drawCover(ctx, cfg).then(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, [cfg, view]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[320px]">
        {view === "front" ? (
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full rounded-lg border shadow-lg"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        ) : (
          <div
            className="flex aspect-[5/7] w-full flex-col gap-4 overflow-auto rounded-lg border p-5 text-sm shadow-lg"
            style={{
              background: cfg.layout?.background ?? "#15131f",
              color: cfg.layout?.titleColor ?? "#fff",
            }}
          >
            <p className="whitespace-pre-line leading-relaxed">
              {backText || "A apresentação da 4ª capa aparece aqui. Use ✨ Gerar."}
            </p>
            {(socialProof ?? []).map((s, i) => (
              <blockquote key={i} className="border-l-2 border-white/40 pl-3 italic opacity-90">
                “{s.quote}”
                <footer className="mt-1 text-xs not-italic opacity-70">— {s.author}</footer>
              </blockquote>
            ))}
          </div>
        )}
      </div>

      {target === "print" && (
        <p className="text-xs text-muted-foreground">
          Lombada:{" "}
          {spineMm ? `${spineMm.toFixed(2)} mm` : "—"} · wrap CMYK 300DPI:{" "}
          <span className="text-amber-600">em breve (worker)</span>
        </p>
      )}
    </div>
  );
}
