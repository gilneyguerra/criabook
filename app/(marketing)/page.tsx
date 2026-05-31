import Link from "next/link";
import { BookOpen, Sparkles, ImageIcon, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2 font-semibold">
          <BookOpen className="size-5" />
          CriaBook
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/cadastro">Criar conta</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" /> Escrita com IA, capítulo a capítulo
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Escreva um livro completo com inteligência artificial
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Do tema à capa: gere a história com efeito de digitação em tempo real,
          ilustre, edite por chat, versione tudo e exporte em PDF e EPUB.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/cadastro">Começar agora</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Já tenho conta</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-6 px-6 pb-24 sm:grid-cols-3">
        <Feature
          icon={<Sparkles className="size-5" />}
          title="Geração em streaming"
          desc="A IA escreve capítulo a capítulo, e você decide quando parar para revisar."
        />
        <Feature
          icon={<ImageIcon className="size-5" />}
          title="Imagens e capa"
          desc="Ilustrações consistentes e um editor de capa estilo designer."
        />
        <Feature
          icon={<FileDown className="size-5" />}
          title="Exporte em tudo"
          desc="PDF para leitura, PDF pronto para impressão e EPUB para e-readers."
        />
      </section>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CriaBook
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-5">
      <div className="flex size-9 items-center justify-center rounded-md bg-secondary">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
