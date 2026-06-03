/**
 * Composição da capa de ebook NO CLIENTE (FERRAMENTA_CAPA §4). Desenha num
 * canvas 2500×3500 a ARTE (Camada 1) + a TIPOGRAFIA real (Camada 2) por cima —
 * texto nunca é "desenhado" pela IA. Só roda no navegador.
 *
 * A arte deve vir de origem com CORS (Vercel Blob) e ser carregada com
 * crossOrigin="anonymous"; caso contrário o canvas fica "tainted" e o export
 * falha — por isso a arte é rehospedada no Blob antes.
 */

export type CoverLayout = {
  titleColor?: string;
  authorColor?: string;
  titlePos?: "top" | "center" | "bottom";
  titleScale?: number; // 0.6–1.6
  overlay?: number; // 0–0.7 (escurece a arte p/ legibilidade)
  background?: string;
};

export type CoverConfig = {
  frontArtUrl?: string | null;
  title?: string | null;
  subtitle?: string | null;
  authorName?: string | null;
  highlight?: string | null;
  fontDisplay?: string | null;
  fontText?: string | null;
  layout?: CoverLayout | null;
};

export const W = 2500;
export const H = 3500;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement
) {
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

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
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

/** Desenha a capa no contexto fornecido (reutilizável por preview e export). */
export async function drawCover(
  ctx: CanvasRenderingContext2D,
  cfg: CoverConfig
): Promise<void> {
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

  const display = cfg.fontDisplay || "Georgia, serif";
  const textFont = cfg.fontText || "Georgia, serif";
  const titleColor = l.titleColor || "#ffffff";
  const authorColor = l.authorColor || "#f0e9da";
  const margin = 220;
  const maxW = W - margin * 2;
  ctx.textAlign = "center";

  // Título
  const scale = l.titleScale ?? 1;
  const titleSize = 210 * scale;
  ctx.font = `700 ${titleSize}px ${display}`;
  ctx.fillStyle = titleColor;
  const titleLines = cfg.title ? wrap(ctx, cfg.title.toUpperCase(), maxW) : [];

  const pos = l.titlePos ?? "top";
  let y = pos === "top" ? 520 : pos === "center" ? H / 2 - 100 : H - 900;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y);
    y += titleSize * 1.05;
  }

  // Subtítulo
  if (cfg.subtitle) {
    ctx.font = `400 ${88}px ${textFont}`;
    ctx.fillStyle = titleColor;
    y += 40;
    for (const line of wrap(ctx, cfg.subtitle, maxW)) {
      ctx.fillText(line, W / 2, y);
      y += 120;
    }
  }

  // Chamada/destaque
  if (cfg.highlight) {
    ctx.font = `600 ${64}px ${textFont}`;
    ctx.fillStyle = authorColor;
    ctx.fillText(cfg.highlight, W / 2, 360);
  }

  // Autor (rodapé)
  if (cfg.authorName) {
    ctx.font = `600 ${110}px ${textFont}`;
    ctx.fillStyle = authorColor;
    ctx.fillText(cfg.authorName, W / 2, H - 280);
  }
}

/** Compõe a capa e retorna um JPEG Blob (null se a arte não pôde ser lida). */
export async function composeCoverBlob(cfg: CoverConfig): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await drawCover(ctx, cfg);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
  );
}
