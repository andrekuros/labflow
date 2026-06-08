import "server-only";
import { registerPlugin } from "@/plugins/registry";
import { examplePlugin } from "@/plugins/example";

/**
 * Built-in plugin loader. Add new first-party plugins here; third-party plugins
 * can be registered the same way from their own entrypoints.
 */
export function registerBuiltinPlugins() {
  registerPlugin(examplePlugin);
}
