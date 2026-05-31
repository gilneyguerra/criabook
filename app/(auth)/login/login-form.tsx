"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";

import { login, type AuthState } from "../actions";
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

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const justSignedUp = searchParams.get("cadastro") === "ok";

  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    login,
    null
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta do CriaBook.</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          {justSignedUp && (
            <p className="rounded-md bg-secondary px-3 py-2 text-sm">
              Conta criada! Confirme seu e-mail (se necessário) e entre.
            </p>
          )}
          <input type="hidden" name="redirect" value={redirectTo} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link href="/cadastro" className="underline underline-offset-4">
              Criar conta
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
