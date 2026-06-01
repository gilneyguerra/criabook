"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { Boxes } from "@/components/ui/background-boxes";
import { Highlight } from "@/components/ui/hero-highlight";
import { Button } from "@/components/ui/button";

export function SiteHero() {
  return (
    <section className="relative flex h-[44rem] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 md:h-[48rem]">
      {/* máscara radial para suavizar as bordas do grid animado */}
      <div className="pointer-events-none absolute inset-0 z-20 bg-zinc-950 [mask-image:radial-gradient(transparent,white)]" />

      <Boxes />

      <div className="relative z-30 flex max-w-3xl flex-col items-center gap-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300 backdrop-blur">
          <Sparkles className="size-3.5 text-indigo-400" />
          Escrita com IA, capítulo a capítulo
        </span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: [20, -5, 0] }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="font-serif text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Transforme uma ideia em um livro completo —{" "}
          <Highlight className="text-white">
            do primeiro capítulo à capa
          </Highlight>
        </motion.h1>

        <p className="max-w-xl text-base text-zinc-300 sm:text-lg">
          A IA escreve diante dos seus olhos, ilustra, monta a capa e exporta em
          PDF e EPUB. Você revisa, edita por chat e versiona tudo.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-indigo-500 text-white hover:bg-indigo-400"
          >
            <Link href="/cadastro">Começar agora</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">Já tenho conta</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
