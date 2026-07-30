import { describe, expect, it, vi } from "vitest";
import { promptForApiKey, promptForSummarySettings } from "../src/setup.js";

describe("masked setup prompt", () => {
  it("does not render the API key and returns it only on submit", async () => {
    const secret = "test-secret-key";
    let rendered = "";

    const ctx = {
      mode: "tui",
      ui: {
        notify: vi.fn(),
        custom: vi.fn(async (factory: any) => {
          return new Promise<string | undefined>((resolve) => {
            const component = factory(
              { requestRender: vi.fn() },
              {
                fg: (_color: string, text: string) => text,
                bold: (text: string) => text,
              },
              {},
              resolve,
            );
            component.focused = true;
            component.handleInput(secret);
            rendered = component.render(100).join("\n");
            component.handleInput("\n");
          });
        }),
      },
    };

    await expect(promptForApiKey(ctx as any)).resolves.toBe(secret);
    expect(rendered).not.toContain(secret);
    expect(rendered).toContain("*".repeat(secret.length));
  });

  it("selects a fixed summary model from Pi models with the active model first", async () => {
    const currentModel = { provider: "openai", id: "current" };
    const scopedModel = { provider: "anthropic", id: "scoped" };
    const select = vi.fn()
      .mockResolvedValueOnce("Auto-summary before returning results")
      .mockResolvedValueOnce("openai/current");
    const ctx = {
      mode: "tui",
      model: currentModel,
      scopedModels: [{ model: scopedModel }],
      modelRegistry: { getAvailable: vi.fn(() => []) },
      ui: { select, notify: vi.fn() },
    };

    await expect(promptForSummarySettings(ctx as any)).resolves.toEqual({
      defaultWorkflow: "summary",
      summaryModel: "openai/current",
    });
    expect(select).toHaveBeenNthCalledWith(2, "Fixed model for optional Querit summaries", [
      "openai/current",
      "anthropic/scoped",
    ]);
  });

  it("refuses non-interactive setup", async () => {
    const notify = vi.fn();
    const ctx = { mode: "print", ui: { notify } };
    await expect(promptForApiKey(ctx as any)).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("interactive TUI"), "error");
  });
});
