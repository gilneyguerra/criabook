"use client";

import { useEffect, useRef } from "react";

/**
 * "Mar de palavras" — fundo animado em canvas 2D.
 * Uma superfície ondulante feita de palavras sutis: a escrita do livro
 * emergindo de um oceano de palavras. Decorativo, atrás do conteúdo.
 *
 * - Sem dependências (canvas puro).
 * - Respeita prefers-reduced-motion (congela em estado estático).
 * - pointer-events-none; não interfere na interação.
 */

const DEFAULT_WORDS = [
  "história", "capítulo", "herói", "jornada", "enredo", "verso", "clímax",
  "trama", "destino", "mistério", "amor", "coragem", "sombra", "luz", "tempo",
  "memória", "sonho", "viagem", "segredo", "começo", "fim", "palavra", "página",
  "livro", "narrativa", "personagem", "reviravolta", "saga", "lenda", "conto",
  "poema", "alma", "voz", "silêncio", "horizonte", "mar", "palavras", "capa",
  "prólogo", "desfecho", "musa", "tinta", "ritmo", "metáfora", "épico",
];

export function SeaOfWords({
  words = DEFAULT_WORDS,
  className,
}: {
  words?: string[];
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    type Item = {
      word: string;
      x: number;
      baseY: number;
      size: number;
      phase: number;
      alpha: number;
    };
    let items: Item[] = [];

    // PRNG determinístico (sem Math.random no SSR; aqui é client, mas mantém estável).
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    function build() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Espaçamento da grade (palavras mais esparsas em telas menores).
      const colGap = width < 640 ? 130 : 160;
      const rowGap = width < 640 ? 46 : 54;
      const cols = Math.ceil(width / colGap) + 1;
      const rows = Math.ceil(height / rowGap) + 1;

      seed = 1337;
      items = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const jitterX = (rand() - 0.5) * colGap * 0.6;
          const jitterY = (rand() - 0.5) * rowGap * 0.4;
          items.push({
            word: words[Math.floor(rand() * words.length)],
            x: c * colGap + jitterX,
            baseY: r * rowGap + jitterY,
            size: 11 + rand() * 5,
            phase: rand() * Math.PI * 2,
            alpha: 0.05 + rand() * 0.07,
          });
        }
      }
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, width, height);
      ctx.textBaseline = "middle";
      const time = t / 1000;
      for (const it of items) {
        // Onda: deslocamento vertical em função de x e tempo (efeito "maré").
        const wave = prefersReduced
          ? 0
          : Math.sin(time * 0.6 + it.x * 0.012 + it.phase) * 8;
        const drift = prefersReduced ? 0 : Math.sin(time * 0.15 + it.phase) * 6;
        ctx.font = `${it.size}px var(--font-serif), Georgia, serif`;
        ctx.fillStyle = `rgba(71, 85, 105, ${it.alpha})`; // slate-600
        ctx.fillText(it.word, it.x + drift, it.baseY + wave);
      }
      if (!prefersReduced) raf = requestAnimationFrame(draw);
    }

    function start() {
      build();
      cancelAnimationFrame(raf);
      if (prefersReduced) {
        draw(0); // render estático único
      } else {
        raf = requestAnimationFrame(draw);
      }
    }

    start();

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(start, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, [words]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
