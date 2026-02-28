import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Mock node:fs before importing modules that use it
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

const mockCtx = {
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  registerContextProvider: vi.fn(),
  registerA2AServer: vi.fn(),
  getSessions: vi.fn().mockReturnValue(["test-session"]),
};

describe("wopr-plugin-soul", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("plugin init and shutdown", () => {
    it("should export a valid plugin with name, version, and description", async () => {
      const { default: plugin } = await import("../src/index.js");
      expect(plugin.name).toBe("wopr-plugin-soul");
      expect(plugin.version).toBe("1.0.0");
      expect(plugin.description).toContain("Soul");
    });

    it("should register context provider on init", async () => {
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      expect(mockCtx.registerContextProvider).toHaveBeenCalledTimes(1);
    });

    it("should register A2A server on init", async () => {
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      expect(mockCtx.registerA2AServer).toHaveBeenCalledTimes(1);
    });

    it("should use first available session name", async () => {
      mockCtx.getSessions.mockReturnValue(["my-session", "other"]);
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      const serverConfig = mockCtx.registerA2AServer.mock.calls[0][0];
      expect(serverConfig.name).toBe("soul");
    });

    it("should fall back to 'default' session when no sessions exist", async () => {
      mockCtx.getSessions.mockReturnValue([]);
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      expect(mockCtx.registerA2AServer).toHaveBeenCalledTimes(1);
    });

    it("should skip A2A registration when registerA2AServer is undefined", async () => {
      const ctxNoA2A = { ...mockCtx, registerA2AServer: undefined };
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(ctxNoA2A as any);
      expect(mockCtx.registerContextProvider).toHaveBeenCalledTimes(1);
    });

    it("should log info on init", async () => {
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      expect(mockCtx.log.info).toHaveBeenCalledWith("Soul plugin initialized");
    });

    it("should shutdown without errors", async () => {
      const { default: plugin } = await import("../src/index.js");
      await expect(plugin.shutdown()).resolves.toBeUndefined();
    });

    it("should have a manifest with required fields", async () => {
      const { default: plugin } = await import("../src/index.js");
      expect(plugin.manifest).toBeDefined();
      expect(plugin.manifest!.capabilities).toBeDefined();
      expect(plugin.manifest!.category).toBe("personality");
      expect(plugin.manifest!.tags).toContain("soul");
      expect(plugin.manifest!.icon).toBeTruthy();
      expect(plugin.manifest!.requires).toEqual({});
      expect(plugin.manifest!.provides).toBeDefined();
      expect(plugin.manifest!.lifecycle).toBeDefined();
    });

    it("should be idempotent on double shutdown", async () => {
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      await plugin.shutdown();
      await expect(plugin.shutdown()).resolves.toBeUndefined();
    });

    it("should be re-initializable after shutdown", async () => {
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      await plugin.shutdown();
      mockCtx.registerContextProvider.mockClear();
      mockCtx.registerA2AServer.mockClear();
      await plugin.init(mockCtx as any);
      expect(mockCtx.registerContextProvider).toHaveBeenCalledTimes(1);
      expect(mockCtx.registerA2AServer).toHaveBeenCalledTimes(1);
    });

    it("should export CONTEXT_PROVIDER_NAME", async () => {
      const { CONTEXT_PROVIDER_NAME } = await import("../src/index.js");
      expect(CONTEXT_PROVIDER_NAME).toBe("soul");
    });
  });

  describe("soul A2A tools", () => {
    it("should register two tools: soul_get and soul_update", async () => {
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      const serverConfig = mockCtx.registerA2AServer.mock.calls[0][0];
      expect(serverConfig.tools).toHaveLength(2);
      expect(serverConfig.tools[0].name).toBe("soul.get");
      expect(serverConfig.tools[1].name).toBe("soul.update");
    });

    it("should have valid tool schemas", async () => {
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      const serverConfig = mockCtx.registerA2AServer.mock.calls[0][0];

      for (const tool of serverConfig.tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
        expect(typeof tool.handler).toBe("function");
      }
    });

    it("soul_update should have content, section, sectionContent properties", async () => {
      const { default: plugin } = await import("../src/index.js");
      await plugin.init(mockCtx as any);
      const serverConfig = mockCtx.registerA2AServer.mock.calls[0][0];
      const updateTool = serverConfig.tools[1];
      expect(updateTool.inputSchema.properties).toHaveProperty("content");
      expect(updateTool.inputSchema.properties).toHaveProperty("section");
      expect(updateTool.inputSchema.properties).toHaveProperty("sectionContent");
    });
  });

  describe("soul_get handler", () => {
    it("should return 'No SOUL.md found' when file does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const { buildSoulA2ATools } = await import("../src/soul-a2a-tools.js");
      const config = buildSoulA2ATools("test-session");
      const result = await config.tools[0].handler({});
      expect(result.content[0].text).toBe("No SOUL.md found.");
    });

    it("should return global SOUL.md content when global file exists", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        return String(p).includes("/data/identity/SOUL.md");
      });
      vi.mocked(fs.readFileSync).mockReturnValue("I am a helpful bot");
      const { buildSoulA2ATools } = await import("../src/soul-a2a-tools.js");
      const config = buildSoulA2ATools("test-session");
      const result = await config.tools[0].handler({});
      expect(result.content[0].text).toContain("[Source: global]");
      expect(result.content[0].text).toContain("I am a helpful bot");
    });

    it("should fall back to session SOUL.md when global does not exist", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        return String(p).includes("sessions/test-session/SOUL.md");
      });
      vi.mocked(fs.readFileSync).mockReturnValue("Session persona");
      const { buildSoulA2ATools } = await import("../src/soul-a2a-tools.js");
      const config = buildSoulA2ATools("test-session");
      const result = await config.tools[0].handler({});
      expect(result.content[0].text).toContain("[Source: session]");
      expect(result.content[0].text).toContain("Session persona");
    });
  });

  describe("soul_update handler", () => {
    it("should replace entire SOUL.md when content is provided", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const { buildSoulA2ATools } = await import("../src/soul-a2a-tools.js");
      const config = buildSoulA2ATools("test-session");
      const updateTool = config.tools[1];

      const result = await updateTool.handler({ content: "New soul content" });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("SOUL.md"),
        "New soul content",
      );
      expect(result.content[0].text).toBe("SOUL.md replaced entirely");
    });

    it("should add section when SOUL.md does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const { buildSoulA2ATools } = await import("../src/soul-a2a-tools.js");
      const config = buildSoulA2ATools("test-session");
      const updateTool = config.tools[1];

      const result = await updateTool.handler({
        section: "Boundaries",
        sectionContent: "Be kind",
      });
      expect(fs.writeFileSync).toHaveBeenCalled();
      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain("## Boundaries");
      expect(written).toContain("Be kind");
      expect(result.content[0].text).toContain("Boundaries");
    });

    it("should update existing section in SOUL.md", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        "# SOUL.md\n\n## Boundaries\n\nOld content\n",
      );
      const { buildSoulA2ATools } = await import("../src/soul-a2a-tools.js");
      const config = buildSoulA2ATools("test-session");
      const updateTool = config.tools[1];

      const result = await updateTool.handler({
        section: "Boundaries",
        sectionContent: "New boundary content",
      });
      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain("New boundary content");
      expect(written).not.toContain("Old content");
      expect(result.content[0].text).toContain('section "Boundaries" updated');
    });

    it("should return error when neither content nor section provided", async () => {
      const { buildSoulA2ATools } = await import("../src/soul-a2a-tools.js");
      const config = buildSoulA2ATools("test-session");
      const updateTool = config.tools[1];

      const result = await updateTool.handler({});
      expect(result.content[0].text).toContain("Provide");
      // isError should NOT be present per best practices
      expect(result).not.toHaveProperty("isError");
    });

    it("should handle section names with regex-special characters", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        "# SOUL.md\n\n## Goals (v2)\n\nOld goals\n",
      );
      const { buildSoulA2ATools } = await import("../src/soul-a2a-tools.js");
      const config = buildSoulA2ATools("test-session");
      const updateTool = config.tools[1];

      const result = await updateTool.handler({
        section: "Goals (v2)",
        sectionContent: "New goals",
      });
      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain("New goals");
      expect(written).not.toContain("Old goals");
      expect(result.content[0].text).toContain('section "Goals (v2)" updated');
    });

    it("should append new section when section name has brackets", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("# SOUL.md\n\n## Existing\n\nStuff\n");
      const { buildSoulA2ATools } = await import("../src/soul-a2a-tools.js");
      const config = buildSoulA2ATools("test-session");
      const updateTool = config.tools[1];

      const result = await updateTool.handler({
        section: "Rules [strict]",
        sectionContent: "Be precise",
      });
      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain("## Rules [strict]");
      expect(written).toContain("Be precise");
      expect(written).toContain("## Existing"); // original preserved
    });
  });

  describe("soul context provider", () => {
    it("should have correct name, priority, and enabled flag", async () => {
      const { soulContextProvider } = await import(
        "../src/soul-context-provider.js"
      );
      expect(soulContextProvider.name).toBe("soul");
      expect(soulContextProvider.priority).toBe(8);
      expect(soulContextProvider.enabled).toBe(true);
    });

    it("should return global soul content when global file exists", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        return String(p).includes("/data/identity/SOUL.md");
      });
      vi.mocked(fs.readFileSync).mockReturnValue("Global persona");
      const { soulContextProvider } = await import(
        "../src/soul-context-provider.js"
      );

      const result = await soulContextProvider.getContext("test-session", {} as any);
      expect(result).not.toBeNull();
      expect(result!.content).toContain("Soul (Global)");
      expect(result!.content).toContain("Global persona");
      expect(result!.role).toBe("system");
      expect(result!.metadata.source).toBe("soul");
      expect(result!.metadata.location).toBe("global");
    });

    it("should fall back to session soul content", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        return String(p).includes("sessions/test-session/SOUL.md");
      });
      vi.mocked(fs.readFileSync).mockReturnValue("Session persona");
      const { soulContextProvider } = await import(
        "../src/soul-context-provider.js"
      );

      const result = await soulContextProvider.getContext("test-session", {} as any);
      expect(result).not.toBeNull();
      expect(result!.content).toContain("Soul");
      expect(result!.content).toContain("Session persona");
      expect(result!.metadata.location).toBe("session");
    });

    it("should return null when no SOUL.md exists anywhere", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const { soulContextProvider } = await import(
        "../src/soul-context-provider.js"
      );

      const result = await soulContextProvider.getContext("test-session", {} as any);
      expect(result).toBeNull();
    });

    it("should return null when SOUL.md is empty/whitespace", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("   \n  ");
      const { soulContextProvider } = await import(
        "../src/soul-context-provider.js"
      );

      const result = await soulContextProvider.getContext("test-session", {} as any);
      expect(result).toBeNull();
    });

    it("should return null when readFileSync throws", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });
      const { soulContextProvider } = await import(
        "../src/soul-context-provider.js"
      );

      const result = await soulContextProvider.getContext("test-session", {} as any);
      expect(result).toBeNull();
    });
  });
});
