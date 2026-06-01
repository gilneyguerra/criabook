import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  ImageIcon,
  FileDown,
  MessageSquare,
  GitBranch,
  Map,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { SiteHero } from "./_components/site-hero";
import { Manifesto } from "./_components/manifesto";
import { EditorPreview } from "./_components/editor-preview";

const features = [
  {
    icon: Sparkles,
    title: "Geração em streaming",
    desc: "A IA escreve capítulo a capítulo, e você decide quando parar para revisar.",
  },
  {
    icon: MessageSquare,
    title: "Edição por chat",
    desc: "Peça mudanças em linguagem natural; o trecho é localizado, corrigido e destacado.",
  },
  {
    icon: Map,
    title: "Mapa da história",
    desc: "Veja e edite os beats da narrativa em um roadmap visual e clicável.",
  },
  {
    icon: ImageIcon,
    title: "Imagens e capa",
    desc: "Ilustrações consistentes e um editor de capa estilo designer.",
  },
  {
    icon: GitBranch,
    title: "Versão e rollback",
    desc: "Cada alteração vira um snapshot — volte para qualquer ponto quando quiser.",
  },
  {
    icon: FileDown,
    title: "Exporte em tudo",
    desc: "PDF para leitura, PDF pronto para impressão e EPUB para e-readers.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex flex-col">
      <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2 font-semibold text-white">
          <BookOpen className="size-5 text-indigo-400" />
          CriaBook
        </div>
        <nav className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-zinc-200 hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">Entrar</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-indigo-500 text-white hover:bg-indigo-400"
          >
            <Link href="/cadastro">Criar conta</Link>
          </Button>
        </nav>
      </header>

      <SiteHero />

      {/* Preview do app revelado ao rolar */}
      <section className="-mt-20">
        <ContainerScroll
          titleComponent={
            <div className="mb-4">
              <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">
                O Studio
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-white md:text-5xl">
                Escreva, edite e ilustre num só lugar
              </h2>
            </div>
          }
        >
          <EditorPreview />
        </ContainerScroll>
      </section>

      <Manifesto />

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-6 py-24">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-3xl font-semibold text-white md:text-4xl">
            Tudo para sair da ideia ao livro publicado
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-indigo-500/40"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/15">
                <Icon className="size-5 text-indigo-400" />
              </div>
              <h3 className="font-medium text-white">{title}</h3>
              <p className="text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-28 text-center">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-indigo-500/10 to-transparent p-10">
          <h2 className="font-serif text-3xl font-semibold text-white md:text-4xl">
            Seu próximo livro começa agora
          </h2>
          <p className="mx-auto mt-3 max-w-md text-zinc-400">
            Crie sua conta, monte a base da história e veja o primeiro capítulo
            nascer.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 bg-indigo-500 text-white hover:bg-indigo-400"
          >
            <Link href="/cadastro">Começar de graça</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} CriaBook · Feito para quem escreve.
      </footer>
    </main>
  );
}
