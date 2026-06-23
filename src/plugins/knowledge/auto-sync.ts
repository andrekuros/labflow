import "server-only";
import { ensurePluginRegistry } from "@/plugins/registry";
import { getNextcloudSettings } from "@/plugins/knowledge/nextcloud-config";
import { syncNextcloudKnowledge } from "@/plugins/knowledge/sync";

const g = globalThis as { __labflowNcAutoSync?: boolean };

/** Periodic Nextcloud sync for long-running `next start` deployments. */
export function startNextcloudAutoSync() {
  if (g.__labflowNcAutoSync) return;
  if (typeof setInterval === "undefined") return;
  g.__labflowNcAutoSync = true;

  setInterval(async () => {
    try {
      await ensurePluginRegistry();
      const cfg = await getNextcloudSettings();
      if (!cfg.enabled || !cfg.autoSyncEnabled) return;
      if (!cfg.url || !cfg.username || !cfg.appPassword) return;

      const last = cfg.lastSyncAt ? new Date(cfg.lastSyncAt).getTime() : 0;
      const intervalMs = Math.max(5, cfg.autoSyncIntervalMinutes) * 60 * 1000;
      if (Date.now() - last < intervalMs) return;

      const result = await syncNextcloudKnowledge();
      if (result.ok) {
        console.log(`[nextcloud] auto-sync: ${result.message}`);
      } else {
        console.warn(`[nextcloud] auto-sync: ${result.message}`);
      }
    } catch (err) {
      console.error("[nextcloud] auto-sync failed", err);
    }
  }, 60_000);
}
