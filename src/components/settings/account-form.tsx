"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Label } from "@/components/ui";
import { updateMyAccountAction } from "@/app/actions/account";

export function AccountForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [formName, setFormName] = useState(name);
  const [formEmail, setFormEmail] = useState(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Minha conta</h2>
        <p className="text-xs text-muted">Atualize seu nome, email e senha de acesso.</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="account-name">Nome</Label>
          <Input
            id="account-name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div>
          <Label htmlFor="account-email">Email</Label>
          <Input
            id="account-email"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs text-muted">
            Para alterar email ou senha, confirme sua senha atual.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="account-current-password">Senha atual</Label>
              <Input
                id="account-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="account-new-password">Nova senha</Label>
                <Input
                  id="account-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Deixe vazio para manter"
                />
              </div>
              <div>
                <Label htmlFor="account-confirm-password">Confirmar nova senha</Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {info && <p className="text-sm text-brand">{info}</p>}

        <div className="flex justify-end">
          <Button
            disabled={pending || !formName.trim() || !formEmail.trim()}
            onClick={() =>
              start(async () => {
                setError("");
                setInfo("");
                const result = await updateMyAccountAction({
                  name: formName,
                  email: formEmail,
                  currentPassword,
                  newPassword: newPassword || undefined,
                  confirmPassword: confirmPassword || undefined,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setInfo("Dados atualizados com sucesso.");
                router.refresh();
              })
            }
          >
            Salvar alteracoes
          </Button>
        </div>
      </div>
    </Card>
  );
}
