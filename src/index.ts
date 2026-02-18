/**
 * WOPR Soul Plugin
 *
 * Provides persistent persona/identity via SOUL.md.
 * Registers:
 *   - soul_get / soul_update A2A tools
 *   - Soul context provider (priority 8)
 */

import type { WOPRPlugin, WOPRPluginContext } from "@wopr-network/plugin-types";
import { buildSoulA2ATools } from "./soul-a2a-tools.js";
import { soulContextProvider } from "./soul-context-provider.js";

const CONTEXT_PROVIDER_NAME = "soul";

const plugin: WOPRPlugin = {
  name: "wopr-plugin-soul",
  version: "1.0.0",
  description: "Soul/personality plugin — persistent agent identity via SOUL.md",

  async init(ctx: WOPRPluginContext) {
    // Register soul context provider at priority 8
    ctx.registerContextProvider(soulContextProvider);

    // Register A2A tools — use first available session or "default"
    const sessions = ctx.getSessions();
    const sessionName = sessions[0] || "default";
    if (ctx.registerA2AServer) {
      ctx.registerA2AServer(buildSoulA2ATools(sessionName));
    }

    ctx.log.info("Soul plugin initialized");
  },

  async shutdown() {
    // Context provider and A2A tools are cleaned up by the daemon on plugin unload.
    // If we need explicit cleanup, the daemon calls unregisterContextProvider.
  },
};

export default plugin;
export { CONTEXT_PROVIDER_NAME };
