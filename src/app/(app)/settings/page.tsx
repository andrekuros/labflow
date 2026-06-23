import { requireAdmin } from "@/lib/rbac";
import { bootstrapAsync } from "@/server/bootstrap";
import { getSettingsData, listApiKeysAction, getProjectsForSettingsAction, getAiSettingsAction, getNextcloudSettingsAction } from "@/app/actions/settings";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  await requireAdmin();
  await bootstrapAsync();

  const [plugins, apiKeys, projects, aiSettings, nextcloudSettings] = await Promise.all([
    getSettingsData(),
    listApiKeysAction(),
    getProjectsForSettingsAction(),
    getAiSettingsAction(),
    getNextcloudSettingsAction(),
  ]);

  return (
    <SettingsClient
      plugins={plugins}
      apiKeys={apiKeys}
      projects={projects}
      aiSettings={aiSettings}
      nextcloudSettings={nextcloudSettings}
    />
  );
}
