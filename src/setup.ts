import { DynamicBorder, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Container, Input, Spacer, Text, type Focusable, type TUI } from "@earendil-works/pi-tui";
import type { SearchWorkflow } from "./config.js";

class MaskedInput extends Input {
  override render(width: number): string[] {
    const secret = this.getValue();
    this.setValue("*".repeat(secret.length));
    try {
      return super.render(width);
    } finally {
      this.setValue(secret);
    }
  }
}

export async function promptForApiKey(ctx: ExtensionCommandContext): Promise<string | undefined> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify("/querit-setup requires Pi's interactive TUI.", "error");
    return undefined;
  }

  return ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
    const container = new Container();
    const input = new MaskedInput();
    input.onSubmit = (value) => done(value.trim() || undefined);
    input.onEscape = () => done(undefined);

    container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("accent", theme.bold("Configure Querit")), 1, 0));
    container.addChild(new Text("Enter your Querit API key. Input is masked and is not added to chat history.", 1, 0));
    container.addChild(new Spacer(1));
    container.addChild(input);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("dim", "Enter to validate and continue • Esc to cancel"), 1, 0));
    container.addChild(new Spacer(1));
    container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));

    return new FocusableContainer(container, input, tui);
  });
}

export interface SummarySetupSelection {
  defaultWorkflow: SearchWorkflow;
  summaryModel?: string;
}

export async function promptForSummarySettings(
  ctx: ExtensionCommandContext,
): Promise<SummarySetupSelection | undefined> {
  if (ctx.mode !== "tui") return { defaultWorkflow: "raw" };

  const workflowChoice = await ctx.ui.select("Default Querit search workflow", [
    "Raw results (recommended)",
    "Auto-summary before returning results",
  ]);
  if (!workflowChoice) return undefined;
  const defaultWorkflow: SearchWorkflow = workflowChoice.startsWith("Auto-summary") ? "summary" : "raw";

  const availableModels = ctx.scopedModels.length > 0
    ? ctx.scopedModels.map((entry) => entry.model)
    : ctx.modelRegistry.getAvailable();
  const modelReferences = new Set<string>();
  if (ctx.model) modelReferences.add(`${ctx.model.provider}/${ctx.model.id}`);
  for (const model of availableModels) modelReferences.add(`${model.provider}/${model.id}`);

  if (modelReferences.size === 0) {
    ctx.ui.notify("No Pi model is currently available for Querit summaries. Raw mode will still work.", "warning");
    return { defaultWorkflow: "raw" };
  }

  const summaryModel = await ctx.ui.select("Fixed model for optional Querit summaries", [...modelReferences]);
  if (!summaryModel) return undefined;
  return { defaultWorkflow, summaryModel };
}

class FocusableContainer implements Focusable {
  private _focused = false;

  constructor(
    private readonly container: Container,
    private readonly input: Input,
    private readonly tui: TUI,
  ) {}

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value;
  }

  render(width: number): string[] {
    return this.container.render(width);
  }

  handleInput(data: string): void {
    this.input.handleInput(data);
    this.tui.requestRender();
  }

  invalidate(): void {
    this.container.invalidate();
  }
}
