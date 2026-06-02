import Link from "next/link";
import { BookOpen } from "lucide-react";

export const metadata = {
  title: "Direitos, IA e privacidade — CriaBook",
};

const SECTIONS = [
  {
    title: "Você detém os direitos da obra",
    body: "O conteúdo que você cria no CriaBook é seu. Você detém todos os direitos comerciais sobre o livro gerado e pode publicá-lo e vendê-lo onde quiser (Amazon KDP, outras lojas, impressão).",
  },
  {
    title: "Conteúdo gerado/assistido por IA",
    body: "Os textos são produzidos com auxílio de inteligência artificial e revisados por você. A Amazon KDP permite conteúdo gerado ou assistido por IA desde que divulgado na publicação — e isso não afeta a elegibilidade ao royalty de 70%. O CriaBook gera o texto de disclosure pronto para você incluir no livro.",
  },
  {
    title: "Seu conteúdo não treina modelos",
    body: "O texto que você escreve ou gera não é usado para treinar modelos de IA. Tratamos seus dados conforme a LGPD: coletamos o mínimo necessário, com finalidade definida, e você pode solicitar exclusão.",
  },
  {
    title: "Privacidade (LGPD)",
    body: "Usamos seus dados apenas para operar o serviço (autenticação, créditos, geração e armazenamento dos seus livros). Não vendemos seus dados. Para dúvidas ou solicitações de titular, fale com o responsável pelos dados.",
  },
];

export default function DireitosPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <BookOpen className="size-5 text-indigo-400" />
        CriaBook
      </Link>

      <div>
        <h1 className="font-serif text-4xl font-semibold">Direitos, IA e privacidade</h1>
        <p className="mt-3 text-zinc-400">
          Transparência sobre autoria, uso de IA e seus dados.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {SECTIONS.map((s) => (
          <section
            key={s.title}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
          >
            <h2 className="font-medium text-white">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
          </section>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        Este resumo não substitui aconselhamento jurídico. As políticas das lojas
        (ex.: Amazon KDP) podem mudar — confirme os requisitos vigentes antes de
        publicar.
      </p>
    </main>
  );
}
