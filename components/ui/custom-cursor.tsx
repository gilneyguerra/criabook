"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Feather } from "lucide-react";

type Ripple = { id: number; x: number; y: number };

/**
 * Cursor personalizado em forma de pena (quill) — conceito "escrever um livro".
 * - A ponta (nib) da pena fica na posição exata do mouse.
 * - Cresce/gira sobre elementos interativos; some sobre campos de texto
 *   (deixa o caret nativo aparecer); clique gera um "pingo de tinta".
 * - Desativado em touch e suavizado com prefers-reduced-motion.
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [overText, setOverText] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleId = useRef(0);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { damping: 30, stiffness: 500, mass: 0.4 });
  const sy = useSpring(y, { damping: 30, stiffness: 500, mass: 0.4 });

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine) return;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    setReduced(prefersReduced);
    setEnabled(true);
    document.documentElement.classList.add("cursor-quill");

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const target = e.target as Element | null;
      const interactive = target?.closest(
        'a, button, [role="button"], label, [data-cursor="grow"]'
      );
      const text = target?.closest(
        'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]'
      );
      setHovering(Boolean(interactive));
      setOverText(Boolean(text));
    };

    const onDown = (e: MouseEvent) => {
      const id = rippleId.current++;
      setRipples((r) => [...r, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setRipples((r) => r.filter((it) => it.id !== id));
      }, 650);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      document.documentElement.classList.remove("cursor-quill");
    };
  }, [x, y]);

  if (!enabled) return null;

  const px = reduced ? x : sx;
  const py = reduced ? y : sy;

  return (
    <>
      {/* Pena */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9999]"
        style={{ x: px, y: py, opacity: overText ? 0 : 1 }}
      >
        <motion.div
          animate={{
            scale: hovering ? 1.25 : 1,
            rotate: hovering ? -28 : -12,
          }}
          transition={{ type: "spring", damping: 18, stiffness: 300 }}
          // Alinha a nib (ponta inferior-esquerda do ícone) ao ponteiro.
          style={{ x: -3, y: -21 }}
        >
          <Feather
            className={
              hovering ? "size-7 text-indigo-600" : "size-6 text-indigo-500"
            }
            strokeWidth={2}
            fill="rgba(99,102,241,0.12)"
          />
        </motion.div>
      </motion.div>

      {/* Pingos de tinta no clique */}
      {!reduced &&
        ripples.map((r) => (
          <motion.span
            key={r.id}
            aria-hidden
            className="pointer-events-none fixed z-[9998] rounded-full bg-indigo-500/30"
            initial={{ width: 6, height: 6, opacity: 0.6 }}
            animate={{ width: 38, height: 38, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              left: r.x,
              top: r.y,
              translateX: "-50%",
              translateY: "-50%",
            }}
          />
        ))}
    </>
  );
}
