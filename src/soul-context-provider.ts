/**
 * Soul context provider — injects SOUL.md content into conversation context.
 *
 * Priority 8: loaded early so the AI sees persona/boundaries before other context.
 *
 * Resolution order:
 *   1. Global identity dir ($WOPR_GLOBAL_IDENTITY or /data/identity) + SOUL.md
 *   2. Session dir ($WOPR_HOME/sessions/<session>) + SOUL.md
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ContextPart, ContextProvider, MessageInfo } from "@wopr-network/plugin-types";

const WOPR_HOME = process.env.WOPR_HOME || join(homedir(), "wopr");
const SESSIONS_DIR = join(WOPR_HOME, "sessions");
const GLOBAL_IDENTITY_DIR = process.env.WOPR_GLOBAL_IDENTITY || "/data/identity";

export const soulContextProvider: ContextProvider = {
  name: "soul",
  priority: 8,
  enabled: true,

  async getContext(session: string, _message: MessageInfo): Promise<ContextPart | null> {
    // Try global identity first
    const globalPath = join(GLOBAL_IDENTITY_DIR, "SOUL.md");
    if (existsSync(globalPath)) {
      try {
        const content = readFileSync(globalPath, "utf-8");
        if (content.trim()) {
          return {
            content: `## Soul (Global)\n\n${content}`,
            role: "system",
            metadata: {
              source: "soul",
              priority: 8,
              location: "global",
            },
          };
        }
      } catch (_error: unknown) {
        // Fall through to session
      }
    }

    // Fall back to session directory
    const sessionPath = join(SESSIONS_DIR, session, "SOUL.md");
    if (existsSync(sessionPath)) {
      try {
        const content = readFileSync(sessionPath, "utf-8");
        if (content.trim()) {
          return {
            content: `## Soul\n\n${content}`,
            role: "system",
            metadata: {
              source: "soul",
              priority: 8,
              location: "session",
            },
          };
        }
      } catch (_error: unknown) {
        // No soul content available
      }
    }

    return null;
  },
};
