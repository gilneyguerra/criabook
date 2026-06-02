"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, BrainCircuit } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Canvas "rede neural" — esfera de neurônios com pulsos e parallax pelo mouse. */
function CosmicSynapseCanvas() {
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
    let neurons: Neuron[] = [];
    let pulses: Pulse[] = [];
    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      radius: 150,
    };
    const perspective = 400;

    class Neuron {
      x: number;
      y: number;
      z: number;
      baseX: number;
      baseY: number;
      baseZ: number;
      radius: number;
      activation: number;
      neighbors: Neuron[];

      constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.baseX = x;
        this.baseY = y;
        this.baseZ = z;
        this.radius = Math.random() * 2 + 1;
        this.activation = 0;
        this.neighbors = [];
      }

      project() {
        const rotX = (mouse.y - el.height / 2) * 0.0001;
        const rotY = (mouse.x - el.width / 2) * 0.0001;
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);

        const x1 = this.x * cosY - this.z * sinY;
        const z1 = this.z * cosY + this.x * sinY;
        const y1 = this.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + this.y * sinX;

        const scale = perspective / (perspective + z2);
        return {
          x: x1 * scale + el.width / 2,
          y: y1 * scale + el.height / 2,
          scale,
        };
      }

      draw() {
        const { x, y, scale } = this.project();
        g.beginPath();
        g.arc(x, y, this.radius * scale, 0, Math.PI * 2);
        g.fillStyle = `rgba(165, 180, 252, ${0.2 + this.activation * 0.8})`; // indigo-300
        g.fill();
      }

      update() {
        const { x: px, y: py } = this.project();
        const dx = mouse.x - px;
        const dy = mouse.y - py;
        const dist = Math.hypot(dx, dy) || 1;
        const force = Math.max(0, (mouse.radius - dist) / mouse.radius);
        this.x += (dx / dist) * force * 0.5;
        this.y += (dy / dist) * force * 0.5;
        this.x += (this.baseX - this.x) * 0.01;
        this.y += (this.baseY - this.y) * 0.01;
        if (this.activation > 0) this.activation -= 0.01;
        this.draw();
      }

      fire() {
        if (this.activation > 0.5) return;
        this.activation = 1;
        this.neighbors.forEach((n) => pulses.push(new Pulse(this, n)));
      }
    }

    class Pulse {
      start: Neuron;
      end: Neuron;
      progress: number;
      speed: number;

      constructor(start: Neuron, end: Neuron) {
        this.start = start;
        this.end = end;
        this.progress = 0;
        this.speed = 0.05;
      }

      update() {
        this.progress += this.speed;
        if (this.progress >= 1) {
          this.end.activation = Math.min(1, this.end.activation + 0.5);
          return true;
        }
        return false;
      }

      draw() {
        const s = this.start.project();
        const e = this.end.project();
        const x = s.x + (e.x - s.x) * this.progress;
        const y = s.y + (e.y - s.y) * this.progress;
        const scale = s.scale + (e.scale - s.scale) * this.progress;
        g.beginPath();
        g.arc(x, y, 2.5 * scale, 0, Math.PI * 2);
        g.fillStyle = `rgba(255, 255, 255, ${1 - this.progress})`;
        g.shadowColor = "white";
        g.shadowBlur = 10;
        g.fill();
        g.shadowBlur = 0;
      }
    }

    const init = () => {
      neurons = [];
      const numNeurons = 800;
      const radius = 250;
      for (let i = 0; i < numNeurons; i++) {
        const phi = Math.acos(-1 + (2 * i) / numNeurons);
        const theta = Math.sqrt(numNeurons * Math.PI) * phi;
        const x = radius * Math.cos(theta) * Math.sin(phi);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        neurons.push(new Neuron(x, y, z));
      }
      neurons.forEach((neuron) => {
        neurons.forEach((other) => {
          if (neuron !== other) {
            const d = Math.hypot(
              neuron.x - other.x,
              neuron.y - other.y,
              neuron.z - other.z
            );
            if (d < 40) neuron.neighbors.push(other);
          }
        });
      });
    };

    const drawStatic = () => {
      g.fillStyle = "rgba(0,0,0,1)";
      g.fillRect(0, 0, el.width, el.height);
      neurons.forEach((n) => n.draw());
    };

    const animate = () => {
      g.fillStyle = "rgba(0, 0, 0, 0.15)";
      g.fillRect(0, 0, el.width, el.height);
      if (Math.random() > 0.99) {
        neurons[Math.floor(Math.random() * neurons.length)].fire();
      }
      neurons.forEach((n) => n.update());
      pulses = pulses.filter((p) => !p.update());
      pulses.forEach((p) => p.draw());
      animationFrameId = requestAnimationFrame(animate);
    };

    let resizeTimer: ReturnType<typeof setTimeout>;
    const resizeCanvas = () => {
      el.width = window.innerWidth;
      el.height = window.innerHeight;
      init();
      if (prefersReduced) drawStatic();
    };
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeCanvas, 200);
    };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);

    resizeCanvas();
    if (!prefersReduced) animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 z-0 h-full w-full bg-black"
    />
  );
}

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2 + 0.4, duration: 0.8, ease: "easeInOut" },
  }),
};

export function NeuralSynapseHero() {
  return (
    <section className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      <CosmicSynapseCanvas />

      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/50 to-transparent" />

      <div className="relative z-20 p-6 text-center">
        <motion.div
          custom={0}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 backdrop-blur-sm"
        >
          <BrainCircuit className="h-4 w-4 text-indigo-300" />
          <span className="text-sm font-medium text-zinc-200">
            Escrita com IA, capítulo a capítulo
          </span>
        </motion.div>

        <motion.h1
          custom={1}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="mb-6 max-w-4xl bg-gradient-to-b from-white to-zinc-400 bg-clip-text font-serif text-4xl font-bold tracking-tight text-transparent sm:text-5xl md:text-6xl"
        >
          Transforme uma ideia em um livro completo
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400"
        >
          A IA escreve diante dos seus olhos, ilustra, monta a capa e exporta em
          PDF e EPUB. Você revisa, edita por chat e versiona tudo — do primeiro
          capítulo à capa.
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            asChild
            size="lg"
            className="bg-white text-black hover:bg-zinc-200"
          >
            <Link href="/cadastro">
              Começar agora
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">Já tenho conta</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
