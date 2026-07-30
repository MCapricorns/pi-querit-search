import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  QueritContentsRequest,
  QueritSearchRequest,
} from "../src/client.js";
import type { QueritConfigSettings } from "../src/config.js";
import { registerQueritExtension } from "../src/index.js";

interface RegisteredTool {
  name: string;
  parameters: unknown;
  execute: (...args: any[]) => Promise<any>;
}

interface RegisteredCommand {
  handler: (...args: any[]) => Promise<void>;
}

const temporaryDirectories: string[] = [];

async function createHarness(options: {
  search?: (request: QueritSearchRequest) => Promise<any>;
  contents?: (request: QueritContentsRequest) => Promise<any>;
  withConfig?: boolean;
  configSettings?: QueritConfigSettings;
  summaryGenerator?: (...args: any[]) => Promise<any>;
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "pi-querit-extension-test-"));
  temporaryDirectories.push(directory);
  const configPath = join(directory, "querit-search.json");
  if (options.withConfig !== false) {
    await import("../src/config.js").then(({ saveQueritConfig }) =>
      saveQueritConfig("test-key", configPath, options.configSettings),
    );
  }

  const tools = new Map<string, RegisteredTool>();
  const commands = new Map<string, RegisteredCommand>();
  const pi = {
    registerTool(tool: RegisteredTool) { tools.set(tool.name, tool); },
    registerCommand(name: string, command: RegisteredCommand) { commands.set(name, command); },
  } as unknown as ExtensionAPI;

  const search = vi.fn(options.search ?? (async (request: QueritSearchRequest) => ({
    query: request.query,
    searchId: "1",
    results: [{ title: "Example", url: "https://example.com/", snippet: "Snippet", sentences: [] }],
  })));
  const contents = vi.fn(options.contents ?? (async () => ({
    searchId: "2",
    results: [{ url: "https://example.com/", content: "Body" }],
    statuses: [{ id: "1", status: "success" }],
  })));

  registerQueritExtension(pi, {
    configPath,
    env: {},
    clientFactory: () => ({ search, contents }),
    ...(options.summaryGenerator ? { summaryGenerator: options.summaryGenerator as any } : {}),
  });

  return { tools, commands, search, contents, configPath };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Pi extension", () => {
  it("registers the standard search/content tools and setup command", async () => {
    const harness = await createHarness();
    expect([...harness.tools.keys()]).toEqual(["web_search", "fetch_content"]);
    expect([...harness.commands.keys()]).toEqual(["querit-setup"]);
  });

  it("maps web_search parameters to the Querit request", async () => {
    const harness = await createHarness();
    const tool = harness.tools.get("web_search")!;
    const result = await tool.execute("call", {
      query: " pi ",
      count: 3,
      include_domains: ["example.com"],
      exclude_domains: ["spam.example"],
      time_range: "d7",
      countries: ["united states"],
      languages: ["english"],
      include_content: true,
      chunks_per_doc: 1,
    }, undefined, vi.fn(), {});

    expect(harness.search).toHaveBeenCalledWith({
      query: "pi",
      count: 3,
      chunksPerDoc: 1,
      needContent: true,
      filters: {
        sites: { include: ["example.com"], exclude: ["spam.example"] },
        timeRange: { date: "d7" },
        geo: { countries: { include: ["united states"] } },
        languages: { include: ["english"] },
      },
    }, undefined);
    expect(result.content[0].text).toContain("https://example.com/");
    expect(result.details.sources).toEqual([{ title: "Example", url: "https://example.com/" }]);
  });

  it("uses the fixed setup model for optional summaries and accounts for usage", async () => {
    const usage = {
      input: 100,
      output: 20,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 120,
      cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
    };
    const summaryGenerator = vi.fn(async () => ({
      summary: "Pi is a coding agent [1].",
      model: "anthropic/summary-model",
      usage,
    }));
    const harness = await createHarness({
      configSettings: { defaultWorkflow: "summary", summaryModel: "anthropic/summary-model" },
      summaryGenerator,
    });
    const tool = harness.tools.get("web_search")!;
    const context = { modelRegistry: {} };
    const summarized = await tool.execute("call", { query: "pi" }, undefined, vi.fn(), context);

    expect(summaryGenerator).toHaveBeenCalledWith(
      expect.objectContaining({ query: "pi" }),
      context,
      "anthropic/summary-model",
      undefined,
    );
    expect(summarized.content[0].text).toContain("Querit auto-summary");
    expect(summarized.content[0].text).toContain("https://example.com/");
    expect(summarized.details.workflow).toBe("summary");
    expect(summarized.details.summaryModel).toBe("anthropic/summary-model");
    expect(summarized.usage).toEqual(usage);

    await tool.execute("call", { query: "pi", workflow: "raw" }, undefined, undefined, context);
    expect(summaryGenerator).toHaveBeenCalledOnce();
  });

  it("falls back to raw results when optional summary generation is unavailable", async () => {
    const harness = await createHarness({
      configSettings: { defaultWorkflow: "raw", summaryModel: "anthropic/summary-model" },
      summaryGenerator: vi.fn(async () => ({ fallbackReason: "model unavailable" })),
    });
    const tool = harness.tools.get("web_search")!;
    const result = await tool.execute("call", { query: "pi", workflow: "summary" }, undefined, undefined, {});

    expect(result.content[0].text).toContain("Auto-summary unavailable: model unavailable");
    expect(result.content[0].text).toContain("# Querit search results");
    expect(result.details.summaryFallbackReason).toBe("model unavailable");
    expect(result.usage).toBeUndefined();
  });

  it("deduplicates and validates fetch_content URLs", async () => {
    const harness = await createHarness();
    const tool = harness.tools.get("fetch_content")!;
    await tool.execute("call", {
      url: "https://example.com",
      urls: ["https://example.com/"],
      format: "text",
      crawl_timeout: 20,
      include_metadata: false,
    }, undefined, vi.fn(), {});

    expect(harness.contents).toHaveBeenCalledWith({
      urls: ["https://example.com/"],
      format: "text",
      crawlTimeout: 20,
      extrasMeta: false,
    }, undefined);

    await expect(tool.execute("call", { url: "file:///etc/passwd" }, undefined, undefined, {})).rejects.toThrow("Unsupported URL protocol");
    await expect(tool.execute("call", { url: "https://user:pass@example.com" }, undefined, undefined, {})).rejects.toThrow("embedded credentials");
  });

  it("reports an actionable error when no key is configured", async () => {
    const harness = await createHarness({ withConfig: false });
    const tool = harness.tools.get("web_search")!;
    await expect(tool.execute("call", { query: "pi" }, undefined, undefined, {})).rejects.toThrow("/querit-setup");
  });

  it("validates and saves a key through /querit-setup", async () => {
    const harness = await createHarness({ withConfig: false });
    const command = harness.commands.get("querit-setup")!;
    const notify = vi.fn();
    const setStatus = vi.fn();
    const currentModel = { provider: "anthropic", id: "summary-model" };
    const select = vi.fn()
      .mockResolvedValueOnce("Raw results (recommended)")
      .mockResolvedValueOnce("anthropic/summary-model");
    const ctx = {
      mode: "tui",
      model: currentModel,
      scopedModels: [{ model: currentModel }],
      modelRegistry: {
        getAvailable: vi.fn(() => [currentModel]),
        find: vi.fn(() => currentModel),
        getApiKeyAndHeaders: vi.fn(async () => ({ ok: true, apiKey: "model-key" })),
      },
      ui: {
        custom: vi.fn().mockResolvedValue("new-test-key"),
        select,
        notify,
        setStatus,
      },
    };

    await command.handler("", ctx);

    expect(harness.search).toHaveBeenCalledWith({ query: "Querit API connectivity test", count: 1 });
    expect(JSON.parse(await readFile(harness.configPath, "utf8"))).toEqual({
      apiKey: "new-test-key",
      defaultWorkflow: "raw",
      summaryModel: "anthropic/summary-model",
    });
    expect(select).toHaveBeenNthCalledWith(2, "Fixed model for optional Querit summaries", ["anthropic/summary-model"]);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("configured successfully"), "info");
    expect(setStatus).toHaveBeenLastCalledWith("querit-setup", undefined);
  });
});
