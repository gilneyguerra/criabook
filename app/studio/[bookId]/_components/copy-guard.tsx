"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";

/**
 * Anti-cópia (anti-cheat): bloqueia COPIAR, RECORTAR, o menu do botão direito e
 * o ARRASTAR dentro do estúdio — onde vive o conteúdo gerado pela IA — tanto por
 * atalho de teclado (Ctrl/Cmd+C/X) quanto pelo botão direito do mouse.
 *
 * Mantém o que o usuário precisa: SELEÇÃO e EDIÇÃO (digitar, COLAR e deletar
 * linhas). Não bloqueia `paste`. Campos de formulário (<input>/<textarea>),
 * como o brief, seguem normais.
 *
 * Os eventos são capturados na fase de CAPTURE com stopImmediatePropagation,
 * impedindo que o handler de clipboard do editor (ProseMirror/TipTap) escreva
 * na área de transferência mesmo após o preventDefault.
 */
export function CopyGuard() {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const flash = () => {
      setShow(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShow(false), 1800);
    };

    const block = (e: Event) => {
      const t = e.target;
      // Campos de formulário continuam normais (edição do próprio usuário).
      if (t instanceof HTMLElement && t.closest("input, textarea")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      flash();
    };

    const events = ["copy", "cut", "contextmenu", "dragstart"];
    events.forEach((ev) => document.addEventListener(ev, block, true));
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, block, true));
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!show) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900/90 px-4 py-2 text-sm text-white shadow-lg"
      role="status"
      aria-live="polite"
    >
      <Lock className="size-4" />
      Conteúdo protegido — cópia desabilitada.
    </div>
  );
}
