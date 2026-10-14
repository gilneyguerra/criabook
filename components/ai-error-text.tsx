import Link from "next/link";

const CREDITS_PATH = "/dashboard/creditos";

/**
 * Mensagem de erro das ações de IA. Se o texto citar a página de créditos
 * (saldo insuficiente, 402), o caminho vira link para comprar.
 */
export function AiErrorText({ text }: { text: string }) {
  const i = text.indexOf(CREDITS_PATH);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <Link href={CREDITS_PATH} className="link-underline font-medium">
        comprar créditos
      </Link>
      {text.slice(i + CREDITS_PATH.length)}
    </>
  );
}

/** Mensagem para respostas HTTP de rotas de IA (402/429). */
export function aiHttpError(status: number, fallback: string): string {
  if (status === 402) return `Créditos insuficientes: ${CREDITS_PATH}`;
  if (status === 429) return "Muitas requisições de IA em pouco tempo. Aguarde um minuto e tente de novo.";
  return fallback;
}
