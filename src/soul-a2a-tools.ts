/**
 * Soul A2A tools: soul_get, soul_update
 *
 * Provides agent-to-agent tools for reading and updating SOUL.md,
 * the persistent persona/boundaries/interaction-style file.
 *
 * Path resolution order:
 *   1. Global identity dir ($WOPR_GLOBAL_IDENTITY or /data/identity) + SOUL.md
 *   2. Session dir ($WOPR_HOME/sessions/<session>) + SOUL.md
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { A2AServerConfig } from "@wopr-network/plugin-types";

const WOPR_HOME = process.env.WOPR_HOME || join(homedir(), "wopr");
const SESSIONS_DIR = join(WOPR_HOME, "sessions");
const GLOBAL_IDENTITY_DIR = process.env.WOPR_GLOBAL_IDENTITY || "/data/identity";

/**
 * Resolve a root-level file by checking global identity first, then session dir.
 */
function resolveRootFile(sessionDir: string, filename: string): { path: string; exists: boolean; isGlobal: boolean } {
  const globalPath = join(GLOBAL_IDENTITY_DIR, filename);
  if (existsSync(globalPath)) {
    return { path: globalPath, exists: true, isGlobal: true };
  }
  const sessionPath = join(sessionDir, filename);
  if (existsSync(sessionPath)) {
    return { path: sessionPath, exists: true, isGlobal: false };
  }
  return { path: sessionPath, exists: false, isGlobal: false };
}

export function buildSoulA2ATools(sessionName: string): A2AServerConfig {
  return {
    name: "soul",
    version: "1.0.0",
    tools: [
      {
        name: "soul.get",
        description:
          "Get current SOUL.md content (persona, boundaries, interaction style). Checks global identity first.",
        inputSchema: { type: "object", additionalProperties: false },
        async handler() {
          const sessionDir = join(SESSIONS_DIR, sessionName);
          const resolved = resolveRootFile(sessionDir, "SOUL.md");
          if (!resolved.exists) {
            return { content: [{ type: "text", text: "No SOUL.md found." }] };
          }
          const content = readFileSync(resolved.path, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: `[Source: ${resolved.isGlobal ? "global" : "session"}]\n\n${content}`,
              },
            ],
          };
        },
      },
      {
        name: "soul.update",
        description: "Update SOUL.md content.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Full content to replace SOUL.md",
            },
            section: {
              type: "string",
              description: "Section header to add/update",
            },
            sectionContent: {
              type: "string",
              description: "Content for the section",
            },
          },
        },
        async handler(args) {
          const { content, section, sectionContent } = args as {
            content?: string;
            section?: string;
            sectionContent?: string;
          };
          const sessionDir = join(SESSIONS_DIR, sessionName);
          const soulPath = join(sessionDir, "SOUL.md");

          if (content) {
            writeFileSync(soulPath, content);
            return { content: [{ type: "text", text: "SOUL.md replaced entirely" }] };
          }

          if (section && sectionContent) {
            let existing = existsSync(soulPath)
              ? readFileSync(soulPath, "utf-8")
              : "# SOUL.md - Persona & Boundaries\n\n";
            const safeSection = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const sectionRegex = new RegExp(`## ${safeSection}[\\s\\S]*?(?=\\n## |$)`, "i");
            const newSection = `## ${section}\n\n${sectionContent}\n`;
            if (existing.match(sectionRegex)) {
              existing = existing.replace(sectionRegex, newSection);
            } else {
              existing += `\n${newSection}`;
            }
            writeFileSync(soulPath, existing);
            return { content: [{ type: "text", text: `SOUL.md section "${section}" updated` }] };
          }

          return {
            content: [{ type: "text", text: "Provide 'content' or 'section'+'sectionContent'" }],
          };
        },
      },
    ],
  };
}
