"use client";

import type React from "react";

import type { TextBoxCfg } from "@/lib/cover/compose";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Caixa de texto arrastável e redimensionável sobre a arte. Trabalha em frações
 * (0–1) do container, então preview e export (canvas 2500×3500) batem. Arraste o
 * corpo para mover; arraste a alça (canto) para redimensionar (largura + fonte).
 */
export function TextBox({
  box,
  cw,
  ch,
  text,
  color,
  fontCss,
  weight,
  active,
  onSelect,
  onChange,
}: {
  box: TextBoxCfg;
  cw: number;
  ch: number;
  text: string;
  color: string;
  fontCss: string;
  weight: number;
  active: boolean;
  onSelect: () => void;
  onChange: (b: TextBoxCfg) => void;
}) {
  function startDrag(e: React.PointerEvent) {
    e.stopPropagation();
    onSelect();
    if (!cw || !ch) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = box.x;
    const oy = box.y;
    const move = (ev: PointerEvent) => {
      onChange({
        ...box,
        x: clamp(ox + (ev.clientX - sx) / cw, 0, 1 - box.w),
        y: clamp(oy + (ev.clientY - sy) / ch, 0, 0.98),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent) {
    e.stopPropagation();
    onSelect();
    if (!cw || !ch) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const ow = box.w;
    const os = box.size;
    const move = (ev: PointerEvent) => {
      onChange({
        ...box,
        w: clamp(ow + (ev.clientX - sx) / cw, 0.12, 1),
        size: clamp(os + ((ev.clientY - sy) / ch) * 0.6, 0.012, 0.22),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const fontPx = box.size * ch;

  return (
    <div
      onPointerDown={startDrag}
      style={{
        position: "absolute",
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        fontFamily: fontCss,
        fontSize: `${fontPx}px`,
        fontWeight: weight,
        lineHeight: 1.12,
        color,
        textAlign: box.align ?? "center",
        cursor: "move",
        userSelect: "none",
        touchAction: "none",
        outline: active ? "1px dashed rgba(255,255,255,0.8)" : "none",
        outlineOffset: 2,
      }}
    >
      {text}
      {active && (
        <span
          onPointerDown={startResize}
          style={{
            position: "absolute",
            right: -7,
            bottom: -7,
            width: 14,
            height: 14,
            background: "#6366f1",
            border: "2px solid #fff",
            borderRadius: 4,
            cursor: "nwse-resize",
          }}
        />
      )}
    </div>
  );
}
