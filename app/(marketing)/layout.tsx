export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Força o tema escuro na área de marketing (ativa as variantes `dark:`
  // dos componentes de fundo/destaque e os tokens escuros do globals.css).
  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-50">{children}</div>
  );
}
