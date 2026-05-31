"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signup, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CadastroPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signup,
    null
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>
          Comece a escrever seu livro com IA.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="display_name">Nome</Label>
            <Input id="display_name" name="display_name" type="text" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 8 caracteres.
            </p>
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Criando..." : "Criar conta"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
