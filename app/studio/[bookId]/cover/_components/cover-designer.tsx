"use client";

import { useMemo, useState } from "react";
import { Sparkles, Loader2, Save, ImageIcon, Download, Coins } from "lucide-react";

import { saveCover, generateCoverTextAction, suggestArtAction } from "../actions";
import { CoverPreview } from "./cover-preview";
import { composeCoverBlob, type CoverConfig, type CoverLayout } from "@/lib/cover/compose";
import { estimatePages, spineWidthMm, bindingAllowsFlaps } from "@/lib/cover/spine";
import { NextStep } from "../../_components/next-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SocialItem = { quote: string; author: string };

const GENRE_PRESETS: Record<string, { style: string; palette: string; layout: CoverLayout }> = {
  Thriller: { style: "fotográfico, alto contraste, sombrio", palette: "preto, vermelho, cinza", layout: { overlay: 0.4, background: "#0a0a0a", titleColor: "#ffffff" } },
  Romance: { style: "ilustrado, tons quentes, suave", palette: "rosa, dourado, creme", layout: { overlay: 0.15, background: "#3a1f2b", titleColor: "#ffffff" } },
  Fantasia: { style: "pictórico, épico, denso", palette: "azul profundo, dourado", layout: { overlay: 0.25, background: "#10162e", titleColor: "#ffffff" } },
  "Não-ficção": { style: "minimalista, limpo, geométrico", palette: "branco, azul, um acento", layout: { overlay: 0.1, background: "#f4f4f0", titleColor: "#10162e" } },
};

const FONTS = ["Georgia, serif", "'Times New Roman', serif", "Helvetica, Arial, sans-serif", "'Courier New', monospace", "Garamond, serif"];

export function CoverDesigner({
  bookId,
  initial,
  totalWords,
  initialBalance,
}: {
  bookId: string;
  initial: Record<string, unknown>;
  totalWords: number;
  initialBalance: number;
}) {
  const i = initial;
  const [frontArtUrl, setFrontArtUrl] = useState<string | null>((i.frontArtUrl as string) ?? null);
  const [artPrompt, setArtPrompt] = useState((i.artPrompt as string) ?? "");
  const [style, setStyle] = useState((i.style as string) ?? "");
  const [palette, setPalette] = useState(
    ((i.palette as { description?: string })?.description) ?? ""
  );
  const [title, setTitle] = useState((i.title as string) ?? "");
  const [subtitle, setSubtitle] = useState((i.subtitle as string) ?? "");
  const [authorName, setAuthorName] = useState((i.authorName as string) ?? "");
  const [highlight, setHighlight] = useState((i.highlight as string) ?? "");
  const [spineText, setSpineText] = useState((i.spineText as string) ?? "");
  const [fontDisplay, setFontDisplay] = useState((i.fontDisplay as string) ?? FONTS[0]);
  const [fontText, setFontText] = useState((i.fontText as string) ?? FONTS[0]);
  const [layout, setLayout] = useState<CoverLayout>((i.layout as CoverLayout) ?? { titleColor: "#ffffff", authorColor: "#f0e9da", titlePos: "top", titleScale: 1, overlay: 0.25, background: "#15131f" });
  const [backText, setBackText] = useState((i.backText as string) ?? "");
  const [socialProof, setSocialProof] = useState<SocialItem[]>((i.socialProof as SocialItem[]) ?? []);
  const [flapFront, setFlapFront] = useState((i.flapFront as string) ?? "");
  const [flapBio, setFlapBio] = useState((i.flapBio as string) ?? "");
  const [target, setTarget] = useState<"ebook" | "print">(((i.target as "ebook" | "print") ?? "ebook"));
  const [binding, setBinding] = useState((i.binding as string) ?? "kdp_brochura");

  const [view, setView] = useState<"front" | "back">("front");
  const [balance, setBalance] = useState(initialBalance);
  const [arting, setArting] = useState(false);
  const [suggestingArt, setSuggestingArt] = useState(false);
  const [genKind, setGenKind] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function setL(patch: Partial<CoverLayout>) {
    setLayout((l) => ({ ...l, ...patch }));
  }

  const cfg: CoverConfig = useMemo(
    () => ({ frontArtUrl, title, subtitle, authorName, highlight, fontDisplay, fontText, layout }),
    [frontArtUrl, title, subtitle, authorName, highlight, fontDisplay, fontText, layout]
  );

  const spineMm = useMemo(
    () => spineWidthMm(estimatePages(totalWords), "white"),
    [totalWords]
  );

  function applyPreset(name: string) {
    const p = GENRE_PRESETS[name];
    if (!p) return;
    setStyle(p.style);
    setPalette(p.palette);
    setL(p.layout);
    setMsg(null);
  }

  async function genArt() {
    if (!artPrompt.trim()) {
      setMsg("Descreva a imagem principal primeiro (ou use ✨ Sugerir).");
      return;
    }
    setArting(true);
    setMsg(null);
    try {
      const r = await fetch("/api/cover/art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, prompt: artPrompt, style, palette, which: "front" }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) {
        setFrontArtUrl(d.url as string);
        if (typeof d.balance === "number") setBalance(d.balance);
      } else {
        setMsg(d.error ?? "Falha ao gerar a arte.");
      }
    } catch {
      setMsg("Falha de conexão ao gerar a arte.");
    } finally {
      setArting(false);
    }
  }

  async function suggestArt() {
    setSuggestingArt(true);
    setMsg(null);
    const res = (await suggestArtAction(bookId)) as {
      ok?: boolean;
      error?: string;
      text?: string;
    };
    setSuggestingArt(false);
    if (res?.ok && res.text) setArtPrompt(res.text);
    else setMsg(res?.error ?? "Não foi possível sugerir.");
  }

  async function genText(kind: "back" | "flapFront" | "bio" | "social") {
    setGenKind(kind);
    setMsg(null);
    const res = (await generateCoverTextAction(bookId, kind)) as {
      ok?: boolean;
      error?: string;
      text?: string;
      social?: SocialItem[];
    };
    setGenKind(null);
    if (!res?.ok) {
      setMsg(res?.error ?? "Falha ao gerar o texto.");
      return;
    }
    if (kind === "back") setBackText(res.text ?? "");
    else if (kind === "flapFront") setFlapFront(res.text ?? "");
    else if (kind === "bio") setFlapBio(res.text ?? "");
    else if (kind === "social") setSocialProof(res.social ?? []);
  }

  async function save() {
    setSaving(true);
    const res = await saveCover(bookId, {
      frontArtUrl,
      artPrompt,
      style: style || null,
      palette: palette ? { description: palette } : null,
      title: title || null,
      subtitle: subtitle || null,
      authorName: authorName || null,
      highlight: highlight || null,
      spineText: spineText || null,
      fontDisplay,
      fontText,
      layout,
      backText: backText || null,
      socialProof,
      flapFront: flapFront || null,
      flapBio: flapBio || null,
      target,
      binding,
      hasFlaps: bindingAllowsFlaps(binding),
      spineWidthMm: String(spineMm),
    });
    setSaving(false);
    setMsg(res?.ok ? "Capa salva." : res?.error ?? "Falha ao salvar.");
    return res?.ok ?? false;
  }

  async function exportCover() {
    setMsg(null);
    const ok = await save();
    if (!ok) return;
    setExporting(true);
    const blob = await composeCoverBlob(cfg);
    if (!blob) {
      setExporting(false);
      setMsg("Não foi possível compor a imagem (a arte pode estar sem CORS — gere a arte novamente).");
      return;
    }
    const fd = new FormData();
    fd.append("bookId", bookId);
    fd.append("file", blob, "capa.jpg");
    const r = await fetch("/api/cover/compose", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setExporting(false);
    setMsg(r.ok && d.url ? "Capa exportada! Já vale para o EPUB e o Dashboard." : d.error ?? "Falha ao exportar.");
  }

  const busy = arting || saving || exporting || genKind !== null || suggestingArt;
  const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
  const areaCls = "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

  function genBtn(kind: "back" | "flapFront" | "bio" | "social", label = "Gerar") {
    return (
      <button type="button" onClick={() => genText(kind)} disabled={genKind === kind}
        className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 disabled:opacity-50">
        {genKind === kind ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
        {label}
      </button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">Passo 2 · Capa</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold">Designer de capa</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            A IA gera só a <strong>arte</strong>; título, autor e textos são camada editável por cima.
            Rascunhe cedo e regenere os textos comerciais depois do livro pronto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
            <Coins className="size-4 text-amber-500" />
            {balance.toLocaleString("pt-BR")}
          </span>
          <Button variant="outline" size="sm" onClick={save} disabled={busy}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
          <Button size="sm" onClick={exportCover} disabled={busy}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Exportar capa
          </Button>
        </div>
      </div>

      {msg && <p className="mb-4 rounded-md bg-secondary/60 px-3 py-2 text-sm">{msg}</p>}

      <div className="grid gap-8 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        {/* Construtor */}
        <div className="flex flex-col gap-8">
          {/* Camada 1 — Arte */}
          <section className="flex flex-col gap-3 rounded-xl border p-5">
            <h2 className="font-medium">Arte (Camada 1)</h2>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(GENRE_PRESETS).map((g) => (
                <button key={g} type="button" onClick={() => applyPreset(g)}
                  className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-indigo-500/50 hover:text-foreground">
                  {g}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Imagem principal</Label>
              <button type="button" onClick={suggestArt} disabled={suggestingArt}
                className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 disabled:opacity-50">
                {suggestingArt ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                Sugerir
              </button>
            </div>
            <textarea rows={2} value={artPrompt} onChange={(e) => setArtPrompt(e.target.value)}
              placeholder="ex.: guerreira solitária sob chuva de néon, plano americano" className={areaCls} />
            <div className="grid grid-cols-2 gap-2">
              <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Estilo" />
              <Input value={palette} onChange={(e) => setPalette(e.target.value)} placeholder="Paleta" />
            </div>
            <Button size="sm" onClick={genArt} disabled={busy}>
              {arting ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
              Gerar arte
            </Button>
          </section>

          {/* Camada 2 — Tipografia */}
          <section className="flex flex-col gap-3 rounded-xl border p-5">
            <h2 className="font-medium">Tipografia (Camada 2)</h2>
            <div className="grid grid-cols-1 gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (1–4 palavras)" />
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtítulo (opcional)" />
              <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Nome do autor" />
              <Input value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder="Chamada/destaque (opcional)" />
              <Input value={spineText} onChange={(e) => setSpineText(e.target.value)} placeholder="Texto da lombada" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Fonte do título</Label>
                <select value={fontDisplay} onChange={(e) => setFontDisplay(e.target.value)} className={inputCls}>
                  {FONTS.map((f) => <option key={f} value={f}>{f.split(",")[0]}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Fonte dos textos</Label>
                <select value={fontText} onChange={(e) => setFontText(e.target.value)} className={inputCls}>
                  {FONTS.map((f) => <option key={f} value={f}>{f.split(",")[0]}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Posição do título</Label>
                <select value={layout.titlePos ?? "top"} onChange={(e) => setL({ titlePos: e.target.value as CoverLayout["titlePos"] })} className={inputCls}>
                  <option value="top">Topo</option>
                  <option value="center">Centro</option>
                  <option value="bottom">Base</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Cor do título</Label>
                  <input type="color" value={layout.titleColor ?? "#ffffff"} onChange={(e) => setL({ titleColor: e.target.value })} className="h-9 w-full rounded-md border" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Cor do autor</Label>
                  <input type="color" value={layout.authorColor ?? "#f0e9da"} onChange={(e) => setL({ authorColor: e.target.value })} className="h-9 w-full rounded-md border" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">Tamanho do título: {(layout.titleScale ?? 1).toFixed(1)}
                <input type="range" min={0.6} max={1.6} step={0.1} value={layout.titleScale ?? 1} onChange={(e) => setL({ titleScale: Number(e.target.value) })} className="w-full" />
              </label>
              <label className="text-xs">Escurecer arte: {Math.round((layout.overlay ?? 0.25) * 100)}%
                <input type="range" min={0} max={0.7} step={0.05} value={layout.overlay ?? 0.25} onChange={(e) => setL({ overlay: Number(e.target.value) })} className="w-full" />
              </label>
            </div>
          </section>

          {/* Camada 3 — Textos */}
          <section className="flex flex-col gap-3 rounded-xl border p-5">
            <h2 className="font-medium">Textos comerciais (Camada 3)</h2>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Apresentação da 4ª capa (não é sinopse)</Label>
              {genBtn("back")}
            </div>
            <textarea rows={4} value={backText} onChange={(e) => setBackText(e.target.value)} className={areaCls} />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Prova social (rascunhos a confirmar)</Label>
              {genBtn("social")}
            </div>
            {socialProof.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {socialProof.map((s, n) => <li key={n}>“{s.quote}” — {s.author}</li>)}
              </ul>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Orelha da capa</Label>
              {genBtn("flapFront")}
            </div>
            <textarea rows={3} value={flapFront} onChange={(e) => setFlapFront(e.target.value)} className={areaCls} />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Bio do autor (↔ Páginas/Sobre o autor)</Label>
              {genBtn("bio")}
            </div>
            <textarea rows={3} value={flapBio} onChange={(e) => setFlapBio(e.target.value)} className={areaCls} />
          </section>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 text-sm">
              {(["ebook", "print"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTarget(t)}
                  className={`rounded-full border px-3 py-1 ${target === t ? "border-indigo-500 text-indigo-600" : "text-muted-foreground"}`}>
                  {t === "ebook" ? "Ebook" : "Impressão"}
                </button>
              ))}
            </div>
            <div className="flex gap-1 text-sm">
              {(["front", "back"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)}
                  className={`rounded-full border px-3 py-1 ${view === v ? "border-indigo-500 text-indigo-600" : "text-muted-foreground"}`}>
                  {v === "front" ? "Capa" : "4ª capa"}
                </button>
              ))}
            </div>
          </div>
          <CoverPreview cfg={cfg} view={view} backText={backText} socialProof={socialProof} spineMm={spineMm} target={target} />
          {target === "print" && (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <Label className="text-xs">Acabamento</Label>
              <select value={binding} onChange={(e) => setBinding(e.target.value)} className={inputCls}>
                <option value="kdp_brochura">Brochura KDP (sem orelhas)</option>
                <option value="brochura_orelhas">Brochura com orelhas</option>
                <option value="capa_dura">Capa dura</option>
              </select>
              <p className="mt-2">
                {bindingAllowsFlaps(binding) ? "Orelhas habilitadas." : "Orelhas desabilitadas neste acabamento."}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end border-t pt-6">
        <NextStep bookId={bookId} seg="roadmap" label="Mapa" />
      </div>
    </div>
  );
}
