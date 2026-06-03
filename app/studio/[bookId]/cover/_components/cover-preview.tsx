"use client";

import { useEffect, useRef } from "react";

import { drawCover, W, H, type CoverConfig } from "@/lib/cover/compose";

type SocialItem = { quote: string; author: string };

export type PreviewView = "front" | "back" | "spine" | "flaps";

export function CoverPreview({
  cfg,
  view,
  backArtUrl,
  backText,
  socialProof,
  flapFront,
  flapBio,
  authorPhotoUrl,
  flapsAllowed,
  spineText,
  spineMm,
  target,
}: {
  cfg: CoverConfig;
  view: PreviewView;
  backArtUrl?: string | null;
  backText?: string | null;
  socialProof?: SocialItem[];
  flapFront?: string | null;
  flapBio?: string | null;
  authorPhotoUrl?: string | null;
  flapsAllowed: boolean;
  spineText?: string | null;
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
    drawCover(ctx, cfg).catch((e) => {
      if (alive) console.error("cover preview draw error:", e);
    });
    return () => {
      alive = false;
    };
  }, [cfg, view]);

  const proof = Array.isArray(socialProof) ? socialProof : [];
  const bg = (cfg.layout?.background as string) ?? "#15131f";
  const fg = (cfg.layout?.titleColor as string) ?? "#fff";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[340px]">
        {view === "front" && (
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full rounded-lg border shadow-lg"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        )}

        {view === "back" && (
          <div
            className="relative flex aspect-[5/7] w-full flex-col gap-4 overflow-auto rounded-lg border p-5 text-sm shadow-lg"
            style={{
              backgroundColor: bg,
              backgroundImage: backArtUrl ? `url(${backArtUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              color: fg,
            }}
          >
            {backArtUrl && <div className="pointer-events-none absolute inset-0 bg-black/35" />}
            <div className="relative z-10 flex flex-col gap-4">
              <p className="whitespace-pre-line leading-relaxed">
                {backText || "A apresentação da contra capa aparece aqui. Use ✨ Gerar."}
              </p>
              {proof.map((s, i) => (
                <blockquote key={i} className="border-l-2 border-white/40 pl-3 italic opacity-90">
                  “{s.quote}”
                  <footer className="mt-1 text-xs not-italic opacity-70">— {s.author}</footer>
                </blockquote>
              ))}
              {!flapsAllowed && flapBio && (
                <p className="mt-2 border-t border-white/20 pt-3 text-xs opacity-90">
                  <strong>Sobre o autor:</strong> {flapBio}
                </p>
              )}
            </div>
          </div>
        )}

        {view === "spine" && (
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-[420px] w-12 items-center justify-center rounded-md border shadow"
              style={{ backgroundColor: bg, color: fg }}
            >
              <span
                className="whitespace-nowrap text-sm font-medium"
                style={{ writingMode: "vertical-rl", fontFamily: cfg.fontDisplay ?? "serif" }}
              >
                {spineText || cfg.title || "Título · Autor"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Largura: {spineMm ? `${spineMm.toFixed(2)} mm` : "—"}
            </p>
          </div>
        )}

        {view === "flaps" && (
          <div className="flex flex-col gap-3 text-sm">
            {!flapsAllowed ? (
              <p className="rounded-lg border border-dashed p-4 text-muted-foreground">
                Este acabamento não tem orelhas (ex.: brochura KDP). Selecione
                “Brochura com orelhas” ou “Capa dura” no acabamento. A bio do autor,
                nesse caso, vai para a contra capa ou para a página “Sobre o autor”.
              </p>
            ) : (
              <>
                <div className="rounded-lg border p-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Orelha da capa
                  </p>
                  <p className="whitespace-pre-line leading-relaxed">
                    {flapFront || "Abordagem editorial / trecho de impacto. Use ✨ Gerar."}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Orelha da contra capa (bio)
                  </p>
                  <div className="flex gap-3">
                    {authorPhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={authorPhotoUrl} alt="Autor" className="size-16 rounded-md object-cover" />
                    )}
                    <p className="whitespace-pre-line text-sm leading-relaxed">
                      {flapBio || "Biografia do autor (3ª pessoa). Use ✨ Gerar."}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {target === "print" && (
        <p className="text-xs text-muted-foreground">
          Wrap CMYK 300DPI completo: <span className="text-amber-600">em breve (worker)</span>
        </p>
      )}
    </div>
  );
}
