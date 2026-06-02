"use client";

import { motion } from "framer-motion";
import { Highlight } from "@/components/ui/hero-highlight";
import { AetherFlowBackground } from "@/components/ui/aether-flow-hero";

export function Manifesto() {
  return (
    <section className="relative flex min-h-[40rem] w-full items-center justify-center overflow-hidden bg-zinc-950">
      <AetherFlowBackground />
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: [20, -5, 0] }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-10 mx-auto max-w-4xl px-6 text-center font-serif text-2xl font-semibold leading-relaxed text-zinc-100 md:text-4xl md:leading-snug"
      >
        Cada ideia é uma rede de conexões. Aqui elas se ligam e a escrita
        acontece{" "}
        <Highlight className="text-white">diante dos seus olhos.</Highlight>
      </motion.h2>
    </section>
  );
}
