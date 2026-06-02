import { CustomCursor } from "@/components/ui/custom-cursor";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Força o tema escuro na área de marketing (ativa as variantes `dark:`
  // dos componentes de fundo/destaque e os tokens escuros do globals.css).
  // O cursor de pena fica SÓ aqui (na landing), não no app logado.
  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-50">
      <CustomCursor />
      {children}
    </div>
  );
}
