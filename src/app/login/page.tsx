"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";
import { FlaskConical } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, { error: "" } as {
    error?: string;
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-fg">
            <FlaskConical size={20} />
          </div>
          <div>
            <p className="text-lg font-semibold leading-tight">LabFlow</p>
            <p className="text-xs text-muted">Gestao do laboratorio de pesquisa</p>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="voce@lab.edu" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Conta de demonstracao: <span className="text-fg">admin@lab.edu</span> / <span className="text-fg">admin123</span>
        </p>
      </Card>
    </div>
  );
}
