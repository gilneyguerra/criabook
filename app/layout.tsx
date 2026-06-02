import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { CustomCursor } from "@/components/ui/custom-cursor";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CriaBook — Gerador de Livros por IA",
  description:
    "Crie um livro completo com IA: escrita capítulo a capítulo, imagens, capa e exportação em PDF e EPUB.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
