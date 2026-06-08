import { uiForSlot } from "@/plugins/registry";
import { bootstrap } from "@/server/bootstrap";
import type { UiSlot } from "@/plugins/types";

/**
 * Renders all plugin UI contributions registered for a given slot.
 * Server component: reads the plugin registry and mounts each contributed
 * component. New plugins appear here automatically, no core changes needed.
 */
export function PluginSlot({ slot }: { slot: UiSlot }) {
  bootstrap();
  const items = uiForSlot(slot);
  if (items.length === 0) return null;
  return (
    <>
      {items.map((it, i) => {
        const Component = it.component;
        return <Component key={`${it.pluginId}-${i}`} />;
      })}
    </>
  );
}
