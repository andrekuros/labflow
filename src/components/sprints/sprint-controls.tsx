"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { setSprintStatus } from "@/plugins/sprints/actions";

export function SprintStatusControl({ sprintId, status, disabled }: { sprintId: string; status: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select
      value={status}
      disabled={disabled || pending}
      onChange={(e) => start(async () => { await setSprintStatus(sprintId, e.target.value); router.refresh(); })}
    >
      <option value="planned">Planejada</option>
      <option value="active">Ativa</option>
      <option value="completed">Concluida</option>
    </Select>
  );
}
