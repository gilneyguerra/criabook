"use client";

import { motion } from "framer-motion";
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";

export function Manifesto() {
  return (
    <HeroHighlight containerClassName="bg-zinc-950">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: [20, -5, 0] }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="mx-auto max-w-4xl px-4 text-center font-serif text-2xl font-semibold leading-relaxed text-zinc-100 md:text-4xl md:leading-snug"
      >
        Você não começa de uma página em branco. Você começa de uma ideia, e a
        escrita acontece{" "}
        <Highlight className="text-white">diante dos seus olhos.</Highlight>
      </motion.h2>
    </HeroHighlight>
  );
}
