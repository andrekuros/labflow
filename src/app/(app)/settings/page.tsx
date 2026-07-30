import { requireUser } from "@/lib/rbac";
import { isAdminUser } from "@/lib/user-access";
import { prisma } from "@/lib/db";
import { bootstrapAsync } from "@/server/bootstrap";
import { getNavItems } from "@/plugins/registry";
import { parsePreferences } from "@/lib/user-preferences";
import {
  getSettingsData,
  listApiKeysAction,
  getAiSettingsAction,
  getNextcloudSettingsAction,
} from "@/app/actions/settings";
import { SettingsClient } from "@/components/settings/settings-client";
import { getLabBranding } from "@/lib/lab-branding";
import { DEFAULT_LAB_NAME } from "@/lib/lab-branding-shared";

export default async function SettingsPage() {
  const session = await requireUser();
  await bootstrapAsync();

  const isAdmin = isAdminUser(session);

  const [user, navItems, plugins, apiKeys, aiSettings, nextcloudSettings, labBranding] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, email: true, preferences: true },
    }),
    getNavItems(),
    isAdmin ? getSettingsData() : Promise.resolve([]),
    isAdmin ? listApiKeysAction() : Promise.resolve([]),
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
      adminOnlyFoldersText: "admin",
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncMessage: null,
      lastSyncCount: 0,
      hasStoredPassword: false,
    }),
    isAdmin ? getLabBranding() : Promise.resolve({ name: DEFAULT_LAB_NAME, logoUrl: null }),
  ]);

  return (
    <SettingsClient
      isAdmin={isAdmin}
      account={{ name: user?.name ?? session.name, email: user?.email ?? session.email }}
      navItems={navItems}
      preferences={parsePreferences(user?.preferences)}
      plugins={plugins}
      apiKeys={apiKeys}
      aiSettings={aiSettings}
      nextcloudSettings={nextcloudSettings}
      labBranding={labBranding}
    />
  );
}
