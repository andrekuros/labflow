"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { deleteUserFromSettingsAction } from "@/app/actions/users";

export function DeleteUserButton({
  userId,
  userName,
  redirectTo = "/settings",
  size = "sm",
}: {
  userId: string;
  userName: string;
  redirectTo?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="danger"
      size={size}
      disabled={pending}
      onClick={() => {
        if (!confirm(`Excluir permanentemente o usuario "${userName}"? Esta acao nao pode ser desfeita.`)) return;
        start(async () => {
          await deleteUserFromSettingsAction(userId);
          router.push(redirectTo);
          router.refresh();
        });
      }}
    >
      <Trash2 size={14} /> Excluir usuario
    </Button>
  );
}
