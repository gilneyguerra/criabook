import { BookOpen, MessageSquare, PanelsTopLeft } from "lucide-react";

/**
 * Mock visual do Studio de escrita, revelado pelo ContainerScroll.
 * É estático (apenas visual) — o editor real chega na Fase 5.
 */
export function EditorPreview() {
  return (
    <div className="flex h-full w-full overflow-hidden rounded-xl bg-zinc-950 text-left text-zinc-200">
      {/* coluna de capítulos */}
      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-white/10 p-4 md:flex">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
          <PanelsTopLeft className="size-4" /> Capítulos
        </div>
        {["Prólogo", "1 · O chamado", "2 · A travessia", "3 · O limiar"].map(
          (c, i) => (
            <div
              key={c}
              className={`rounded-md px-2 py-1.5 text-sm ${
                i === 1
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-zinc-400"
              }`}
            >
              {c}
            </div>
          )
        )}
      </aside>

      {/* área de escrita */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-sm text-zinc-400">
          <BookOpen className="size-4 text-indigo-400" />
          Capítulo 1 · O chamado
          <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-300">
            gerando…
          </span>
        </div>

        <div className="flex-1 space-y-4 overflow-hidden px-6 py-6 font-serif text-[15px] leading-relaxed text-zinc-300 md:text-base">
          <p>
            A manhã chegou sem pressa sobre os telhados de ardósia, e Lia ainda
            não sabia que aquele seria o último dia em que o vilarejo a
            reconheceria como uma de seus.
          </p>
          <p>
            O envelope sobre a mesa não tinha remetente — apenas seu nome,
            escrito com uma caligrafia que ela jurava já ter visto antes
            <span className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-pulse bg-indigo-400 align-middle" />
          </p>
        </div>

        {/* chat de edição */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-400">
            <MessageSquare className="size-4 text-indigo-400" />
            Deixe o capítulo mais sombrio e termine com um suspense…
          </div>
        </div>
      </div>
    </div>
  );
}
