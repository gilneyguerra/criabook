import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Botão padronizado "Próximo: <etapa> →" (FLUXO_E_UX §6). Encadeia as etapas
 * do fluxo; o usuário ainda navega livremente pelo header.
 */
export function NextStep({
  bookId,
  seg,
  label,
}: {
  bookId: string;
  seg: string;
  label: string;
}) {
  return (
    <Link
      href={`/studio/${bookId}/${seg}`}
      className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
    >
      Próximo: {label}
      <ArrowRight className="size-4" />
    </Link>
  );
}
