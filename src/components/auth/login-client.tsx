"use client";

import { useActionState, useState } from "react";
import { loginAction, registerAction } from "@/app/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export function LoginClient({
  allowRegister,
  inactiveMessage,
}: {
  allowRegister: boolean;
  inactiveMessage?: string;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, { error: "" } as { error?: string });
  const [registerState, registerFormAction, registerPending] = useActionState(registerAction, {
    error: "",
    success: false,
    message: "",
  } as { error?: string; success?: boolean; message?: string });

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

        {allowRegister && (
          <div className="mb-4 flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm transition",
                mode === "login" ? "bg-brand/15 font-medium text-fg" : "text-muted hover:text-fg",
              )}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm transition",
                mode === "register" ? "bg-brand/15 font-medium text-fg" : "text-muted hover:text-fg",
              )}
            >
              Cadastrar
            </button>
          </div>
        )}

        {inactiveMessage && (
          <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {inactiveMessage}
          </p>
        )}

        {mode === "login" ? (
          <form action={loginFormAction} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="voce@lab.edu" autoComplete="email" required />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {loginState?.error && <p className="text-sm text-red-400">{loginState.error}</p>}
            <Button type="submit" className="w-full" disabled={loginPending}>
              {loginPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        ) : (
          <form action={registerFormAction} className="space-y-4">
            <div>
              <Label htmlFor="reg-name">Nome completo</Label>
              <Input id="reg-name" name="name" required />
            </div>
            <div>
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" name="email" type="email" placeholder="voce@lab.edu" autoComplete="email" required />
            </div>
            <div>
              <Label htmlFor="reg-title">Titulo / vinculo (opcional)</Label>
              <Input id="reg-title" name="title" placeholder="ex: Mestrando" />
            </div>
            <div>
              <Label htmlFor="reg-password">Senha</Label>
              <Input id="reg-password" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div>
              <Label htmlFor="reg-confirm">Confirmar senha</Label>
              <Input id="reg-confirm" name="confirm" type="password" autoComplete="new-password" required />
            </div>
            {registerState?.error && <p className="text-sm text-red-400">{registerState.error}</p>}
            {registerState?.success && registerState.message && (
              <p className="text-sm text-brand">{registerState.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={registerPending}>
              {registerPending ? "Enviando..." : "Solicitar acesso"}
            </Button>
            <p className="text-center text-xs text-muted">
              O administrador revisara seu cadastro antes de liberar o acesso.
            </p>
          </form>
        )}

        {mode === "login" && (
          <p className="mt-6 text-center text-xs text-muted">
            Demo: <span className="text-fg">admin@lab.edu</span> / <span className="text-fg">admin123</span>
          </p>
        )}
      </Card>
    </div>
  );
}
