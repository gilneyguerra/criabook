"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

import {
  DEFAULT_BOXES,
  BOX_ORDER,
  boxText,
  boxFont,
  boxColor,
  type BoxKey,
  type TextBoxCfg,
  type CoverConfig,
} from "@/lib/cover/compose";
import { TextBox } from "./text-box";

type SocialItem = { quote: string; author: string };
export type PreviewView = "front" | "back" | "spine" | "flaps";
export type GenKind = "back" | "social" | "flapFront" | "bio";

function GenBtn({
  kind,
  label,
  onGen,
  genKind,
}: {
  kind: GenKind;
  label: string;
  onGen?: (k: GenKind) => void;
  genKind?: string | null;
}) {
  if (!onGen) return null;
  return (
    <button
      type="button"
      onClick={() => onGen(kind)}
      disabled={genKind === kind}
      className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
    >
      {genKind === kind ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
      {label}
    </button>
  );
}

export function CoverPreview({
  cfg,
  view,
  boxes,
  onBoxChange,
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
  onGen,
  genKind,
}: {
  cfg: CoverConfig;
  view: PreviewView;
  boxes: Partial<Record<BoxKey, TextBoxCfg>>;
  onBoxChange: (key: BoxKey, box: TextBoxCfg) => void;
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
  onGen?: (k: GenKind) => void;
  genKind?: string | null;
}) {
  const frontRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<BoxKey | null>(null);

  useEffect(() => {
    if (view !== "front") return;
    const el = frontRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const proof = Array.isArray(socialProof) ? socialProof : [];
  const bg = (cfg.layout?.background as string) ?? "#15131f";
  const fg = (cfg.layout?.titleColor as string) ?? "#fff";
  const overlay = cfg.layout?.overlay ?? 0.25;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[460px]">
        {view === "front" && (
          <div
            ref={frontRef}
            className="relative aspect-[5/7] w-full overflow-hidden rounded-lg border shadow-lg"
            style={{
              backgroundColor: bg,
              backgroundImage: cfg.frontArtUrl ? `url(${cfg.frontArtUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            onPointerDown={() => setSelected(null)}
          >
            {cfg.frontArtUrl && overlay > 0 && (
              <div className="pointer-events-none absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
            )}
            {BOX_ORDER.map((key) => {
              const text = boxText(cfg, key).trim();
              if (!text) return null;
              const box = { ...DEFAULT_BOXES[key], ...(boxes[key] ?? {}) };
              return (
                <TextBox
                  key={key}
                  box={box}
                  cw={size.w}
                  ch={size.h}
                  text={key === "title" ? text.toUpperCase() : text}
                  color={boxColor(cfg, key)}
                  fontCss={boxFont(cfg, key)}
                  weight={key === "title" ? 700 : key === "author" ? 600 : 400}
                  active={selected === key}
                  onSelect={() => setSelected(key)}
                  onChange={(b) => onBoxChange(key, b)}
                />
              );
            })}
          </div>
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
            {backArtUrl && <div className="pointer-events-none absolute inset-0 bg-black/40" />}
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center justify-end">
                <GenBtn kind="back" label="Gerar apresentação" onGen={onGen} genKind={genKind} />
              </div>
              {backText && <p className="whitespace-pre-line leading-relaxed">{backText}</p>}
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
              className="flex h-[460px] w-12 items-center justify-center rounded-md border shadow"
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
                “Brochura com orelhas” ou “Capa dura”. A bio, nesse caso, vai para a
                contra capa ou para a página “Sobre o autor”.
              </p>
            ) : (
              <>
                <div className="rounded-lg border p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Orelha da capa</p>
                    <GenBtn kind="flapFront" label="Gerar" onGen={onGen} genKind={genKind} />
                  </div>
                  <p className="whitespace-pre-line leading-relaxed">
                    {flapFront || "Abordagem editorial / trecho de impacto."}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      Orelha da contra capa (bio)
                    </p>
                    <GenBtn kind="bio" label="Gerar" onGen={onGen} genKind={genKind} />
                  </div>
                  <div className="flex gap-3">
                    {authorPhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={authorPhotoUrl} alt="Autor" className="size-16 rounded-md object-cover" />
                    )}
                    <p className="whitespace-pre-line text-sm leading-relaxed">
                      {flapBio || "Biografia do autor (3ª pessoa)."}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {view === "front" && (
        <p className="text-xs text-muted-foreground">
          Arraste cada texto para posicionar; arraste a alça (canto) para
          redimensionar.
        </p>
      )}
      {target === "print" && (
        <p className="text-xs text-muted-foreground">
          Wrap CMYK 300DPI completo: <span className="text-amber-600">em breve (worker)</span>
        </p>
      )}
    </div>
  );
}
