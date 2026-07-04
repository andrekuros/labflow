import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { bootstrapAsync } from "@/server/bootstrap";
import { getNavItems } from "@/plugins/registry";
import { parsePreferences } from "@/lib/user-preferences";
import {
  getSettingsData,
  listApiKeysAction,
  getProjectsForSettingsAction,
  getAiSettingsAction,
  getNextcloudSettingsAction,
} from "@/app/actions/settings";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const session = await requireUser();
  await bootstrapAsync();

  const isAdmin = session.role === "admin";

  const [user, navItems, plugins, apiKeys, projects, aiSettings, nextcloudSettings] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id }, select: { preferences: true } }),
    getNavItems(),
    isAdmin ? getSettingsData() : Promise.resolve([]),
    isAdmin ? listApiKeysAction() : Promise.resolve([]),
    isAdmin ? getProjectsForSettingsAction() : Promise.resolve([]),
    isAdmin ? getAiSettingsAction() : Promise.resolve({
      aiProvider: "none",
      aiApiKey: "",
      aiBaseUrl: "",
      aiChatModel: "",
      aiEmbeddingModel: "",
      hasStoredKey: false,
      configSource: "default",
    }),
    isAdmin ? getNextcloudSettingsAction() : Promise.resolve({
      enabled: false,
      url: "",
      username: "",
      appPassword: "",
      folder: "LabFlow",
      autoSyncEnabled: false,
      autoSyncIntervalMinutes: 60,
      folderProjectMapJson: "{}",
      excludeFoldersText: "",
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncMessage: null,
      lastSyncCount: 0,
      hasStoredPassword: false,
    }),
  ]);

  return (
    <SettingsClient
      isAdmin={isAdmin}
      navItems={navItems}
      preferences={parsePreferences(user?.preferences)}
      plugins={plugins}
      apiKeys={apiKeys}
      projects={projects}
      aiSettings={aiSettings}
      nextcloudSettings={nextcloudSettings}
    />
  );
}
