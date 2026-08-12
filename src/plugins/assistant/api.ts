import { jsonError, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { askAssistant } from "@/plugins/assistant/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "POST ask": async ({ user }, body) => {
    if (!(await hasPermission(user, "assistant:use"))) return jsonError("Sem permissao", 403);
    const input = body as { question?: string; agentKey?: string };
    if (!input?.question?.trim()) return jsonError("Campo question obrigatorio");
    return runApiAction(() =>
      askAssistant({ question: input.question!, agentKey: input.agentKey }),
    );
  },
};
