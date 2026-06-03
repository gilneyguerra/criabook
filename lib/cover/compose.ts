/**
 * Composição da capa de ebook NO CLIENTE (FERRAMENTA_CAPA §4). Desenha num
 * canvas 2500×3500 a ARTE (Camada 1) + a TIPOGRAFIA real (Camada 2) por cima —
 * texto nunca é "desenhado" pela IA.
 *
 * A tipografia vive em CAIXAS posicionáveis/redimensionáveis (frações 0–1 do
 * tamanho da capa), então o preview e o export usam exatamente as mesmas
 * coordenadas. A arte vem do Vercel Blob (CORS) e carrega com
 * crossOrigin="anonymous" para o canvas não ficar "tainted".
 */

import { ensureFont } from "@/lib/cover/fonts";

export type CoverLayout = {
  titleColor?: string;
  authorColor?: string;
  overlay?: number; // 0–0.7 escurece a arte
  background?: string;
  // posição/tom legados (mantidos por compat; não usados no novo layout):
  titlePos?: "top" | "center" | "bottom";
  titleScale?: number;
};

export type BoxKey = "highlight" | "title" | "subtitle" | "author";

export type TextBoxCfg = {
  x: number; // fração 0–1 (canto sup-esq)
  y: number;
  w: number; // largura fração
  size: number; // tamanho da fonte como fração da ALTURA da capa
  align?: "left" | "center" | "right";
};

export type CoverBoxes = Partial<Record<BoxKey, TextBoxCfg>>;

export type CoverConfig = {
  frontArtUrl?: string | null;
  title?: string | null;
  subtitle?: string | null;
  authorName?: string | null;
  highlight?: string | null;
  fontDisplay?: string | null;
  fontText?: string | null;
  layout?: CoverLayout | null;
  boxes?: CoverBoxes | null;
};

export const W = 2500;
export const H = 3500;

export const DEFAULT_BOXES: Record<BoxKey, TextBoxCfg> = {
  highlight: { x: 0.1, y: 0.05, w: 0.8, size: 0.022, align: "center" },
  title: { x: 0.08, y: 0.12, w: 0.84, size: 0.075, align: "center" },
  subtitle: { x: 0.12, y: 0.3, w: 0.76, size: 0.03, align: "center" },
  author: { x: 0.1, y: 0.9, w: 0.8, size: 0.035, align: "center" },
};

export const BOX_ORDER: BoxKey[] = ["highlight", "title", "subtitle", "author"];

export function boxText(cfg: CoverConfig, key: BoxKey): string {
  if (key === "title") return cfg.title ?? "";
  if (key === "subtitle") return cfg.subtitle ?? "";
  if (key === "author") return cfg.authorName ?? "";
  return cfg.highlight ?? "";
}

export function boxFont(cfg: CoverConfig, key: BoxKey): string {
  const display = cfg.fontDisplay || "Georgia, serif";
  const text = cfg.fontText || "Georgia, serif";
  return key === "title" ? display : text;
}

export function boxColor(cfg: CoverConfig, key: BoxKey): string {
  const l = cfg.layout ?? {};
  return key === "author" ? l.authorColor || "#f0e9da" : l.titleColor || "#ffffff";
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCoverFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const ir = img.width / img.height;
  const cr = W / H;
  let dw = W;
  let dh = H;
  if (ir > cr) {
    dh = H;
    dw = H * ir;
  } else {
    dw = W;
    dh = W / ir;
  }
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawBox(ctx: CanvasRenderingContext2D, cfg: CoverConfig, key: BoxKey) {
  const text = boxText(cfg, key).trim();
  if (!text) return;
  const b = { ...DEFAULT_BOXES[key], ...(cfg.boxes?.[key] ?? {}) };
  const fontPx = Math.max(8, b.size * H);
  const weight = key === "title" ? 700 : key === "author" ? 600 : 400;
  ctx.font = `${weight} ${fontPx}px ${boxFont(cfg, key)}`;
  ctx.fillStyle = boxColor(cfg, key);
  ctx.textBaseline = "top";

  const boxW = b.w * W;
  const boxX = b.x * W;
  const align = b.align ?? "center";
  ctx.textAlign = align;
  const anchorX = align === "left" ? boxX : align === "right" ? boxX + boxW : boxX + boxW / 2;

  const display = key === "title" ? text.toUpperCase() : text;
  let y = b.y * H;
  for (const line of wrap(ctx, display, boxW)) {
    ctx.fillText(line, anchorX, y);
    y += fontPx * 1.12;
  }
}

/** Desenha a capa no contexto fornecido (preview e export usam o mesmo código). */
export async function drawCover(ctx: CanvasRenderingContext2D, cfg: CoverConfig): Promise<void> {
  const l = cfg.layout ?? {};
  ctx.fillStyle = l.background ?? "#15131f";
  ctx.fillRect(0, 0, W, H);

  if (cfg.frontArtUrl) {
    const img = await loadImage(cfg.frontArtUrl);
    if (img) drawCoverFit(ctx, img);
  }

  const ov = l.overlay ?? 0.25;
  if (ov > 0) {
    ctx.fillStyle = `rgba(0,0,0,${ov})`;
    ctx.fillRect(0, 0, W, H);
  }

  await ensureFont(boxFont(cfg, "title"));
  await ensureFont(boxFont(cfg, "author"));
  for (const key of BOX_ORDER) drawBox(ctx, cfg, key);
}

/** Compõe a capa e retorna um JPEG Blob (null se a arte não pôde ser lida). */
export async function composeCoverBlob(cfg: CoverConfig): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await drawCover(ctx, cfg);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92));
}
