import { BookPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  // A tabela `books` e a listagem real chegam na Fase 1 (modelo de dados).
  const books: { id: string; title: string }[] = [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus livros</h1>
          <p className="text-sm text-muted-foreground">
            Crie um novo livro ou continue um rascunho.
          </p>
        </div>
        <Button disabled>
          <BookPlus className="size-4" />
          Novo livro
        </Button>
      </div>

      {books.length === 0 ? (
        <Card className="items-center gap-3 border-dashed py-16 text-center">
          <CardHeader className="items-center">
            <CardTitle>Nenhum livro ainda</CardTitle>
            <CardDescription>
              A criação de livros chega na Fase 3 (construtor de prompt).
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
