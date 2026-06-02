"use client";

import { useEffect, useRef } from "react";

/**
 * Fundo "Aether Flow": rede de partículas conectadas que reagem ao mouse.
 * Reescrito em TS-safe e escopado ao container (não à janela), para funcionar
 * como fundo de uma seção no meio da página. Respeita prefers-reduced-motion.
 */
export function AetherFlowBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const el = canvas; // não-nulo p/ closures
    const g = context;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let animationFrameId = 0;
    let particles: Particle[] = [];
    const mouse: { x: number | null; y: number | null; radius: number } = {
      x: null,
      y: null,
      radius: 160,
    };

    class Particle {
      x: number;
      y: number;
      dx: number;
      dy: number;
      size: number;

      constructor(x: number, y: number, dx: number, dy: number, size: number) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.size = size;
      }

      draw() {
        g.beginPath();
        g.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        g.fillStyle = "rgba(167, 139, 250, 0.8)"; // violet-400
        g.fill();
      }

      update() {
        if (this.x > el.width || this.x < 0) this.dx = -this.dx;
        if (this.y > el.height || this.y < 0) this.dy = -this.dy;

        if (mouse.x !== null && mouse.y !== null) {
          const ddx = mouse.x - this.x;
          const ddy = mouse.y - this.y;
          const distance = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          if (distance < mouse.radius + this.size) {
            const force = (mouse.radius - distance) / mouse.radius;
            this.x -= (ddx / distance) * force * 5;
            this.y -= (ddy / distance) * force * 5;
          }
        }

        this.x += this.dx;
        this.y += this.dy;
        this.draw();
      }
    }

    const init = () => {
      particles = [];
      const count = Math.min(140, (el.width * el.height) / 9000);
      for (let i = 0; i < count; i++) {
        const size = Math.random() * 2 + 1;
        const x = Math.random() * (el.width - size * 4) + size * 2;
        const y = Math.random() * (el.height - size * 4) + size * 2;
        const dx = Math.random() * 0.4 - 0.2;
        const dy = Math.random() * 0.4 - 0.2;
        particles.push(new Particle(x, y, dx, dy, size));
      }
    };

    const connect = () => {
      const maxDist = (el.width / 7) * (el.height / 7);
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const distance = dx * dx + dy * dy;
          if (distance < maxDist) {
            const opacity = 1 - distance / 20000;
            if (opacity <= 0) continue;
            let nearMouse = false;
            if (mouse.x !== null && mouse.y !== null) {
              const mdx = particles[a].x - mouse.x;
              const mdy = particles[a].y - mouse.y;
              nearMouse = Math.sqrt(mdx * mdx + mdy * mdy) < mouse.radius;
            }
            g.strokeStyle = nearMouse
              ? `rgba(255, 255, 255, ${opacity})`
              : `rgba(167, 139, 250, ${opacity})`;
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(particles[a].x, particles[a].y);
            g.lineTo(particles[b].x, particles[b].y);
            g.stroke();
          }
        }
      }
    };

    const frame = () => {
      g.fillStyle = "rgb(9, 9, 11)"; // zinc-950
      g.fillRect(0, 0, el.width, el.height);
      for (const p of particles) p.update();
      connect();
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      frame();
    };

    let resizeTimer: ReturnType<typeof setTimeout>;
    const resize = () => {
      el.width = el.clientWidth;
      el.height = el.clientHeight;
      init();
      if (prefersReduced) frame();
    };
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Só considera dentro da seção.
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        mouse.x = null;
        mouse.y = null;
      } else {
        mouse.x = x;
        mouse.y = y;
      }
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    window.addEventListener("mousemove", onMouseMove);

    resize();
    if (!prefersReduced) animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(resizeTimer);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={
        className ?? "pointer-events-none absolute inset-0 h-full w-full"
      }
    />
  );
}
