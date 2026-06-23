import { jsonError, jsonOk, readJsonBody } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { askAssistant } from "@/plugins/assistant/actions";

export const handlers: PluginApiHandlers = {
  "POST /ask": async (ctx) => {
    const body = await readJsonBody<{ question?: string; agentKey?: string }>(ctx.request);
    if (!body?.question?.trim()) return jsonError("Campo question obrigatorio");
    const result = await askAssistant({ question: body.question, agentKey: body.agentKey });
    return jsonOk(result);
  },
};
