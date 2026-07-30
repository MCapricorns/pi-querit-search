import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir, withFileMutationQueue } from "@earendil-works/pi-coding-agent";

export const QUERIT_CONFIG_FILE = "querit-search.json";

export type SearchWorkflow = "raw" | "summary";

export interface QueritConfig {
  apiKey: string;
  defaultWorkflow?: SearchWorkflow;
  summaryModel?: string;
}

export interface QueritConfigSettings {
  defaultWorkflow?: SearchWorkflow;
  summaryModel?: string;
}

export interface ApiKeyResolutionOptions {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}

export function getQueritConfigPath(agentDir = getAgentDir()): string {
  return join(agentDir, QUERIT_CONFIG_FILE);
}

export async function loadQueritConfig(configPath = getQueritConfigPath()): Promise<QueritConfig | undefined> {
  let text: string;
  try {
    text = await readFile(configPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw new Error(`Could not read Querit configuration at ${configPath}: ${errorMessage(error)}`, {
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Querit configuration at ${configPath} is not valid JSON.`, { cause: error });
  }

  if (!isRecord(parsed) || typeof parsed.apiKey !== "string" || !parsed.apiKey.trim()) {
    throw new Error(`Querit configuration at ${configPath} must contain a non-empty "apiKey" string.`);
  }

  const defaultWorkflow = parsed.defaultWorkflow === "raw" || parsed.defaultWorkflow === "summary"
    ? parsed.defaultWorkflow
    : undefined;
  const summaryModel = typeof parsed.summaryModel === "string" && isModelReference(parsed.summaryModel)
    ? parsed.summaryModel.trim()
    : undefined;

  return {
    apiKey: parsed.apiKey.trim(),
    ...(defaultWorkflow === undefined ? {} : { defaultWorkflow }),
    ...(summaryModel === undefined ? {} : { summaryModel }),
  };
}

export async function resolveQueritApiKey(options: ApiKeyResolutionOptions = {}): Promise<string | undefined> {
  const config = await loadQueritConfig(options.configPath ?? getQueritConfigPath());
  if (config?.apiKey) return config.apiKey;

  const environmentKey = (options.env ?? process.env).QUERIT_API_KEY?.trim();
  return environmentKey || undefined;
}

export async function saveQueritConfig(
  apiKey: string,
  configPath = getQueritConfigPath(),
  settings: QueritConfigSettings = {},
): Promise<void> {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("Cannot save an empty Querit API key.");
  if (settings.defaultWorkflow !== undefined && settings.defaultWorkflow !== "raw" && settings.defaultWorkflow !== "summary") {
    throw new Error("Cannot save an invalid Querit default workflow.");
  }
  const summaryModel = settings.summaryModel?.trim();
  if (summaryModel !== undefined && !isModelReference(summaryModel)) {
    throw new Error("Cannot save an invalid Querit summary model reference.");
  }
  const serializedConfig: QueritConfig = {
    apiKey: normalizedKey,
    ...(settings.defaultWorkflow === undefined ? {} : { defaultWorkflow: settings.defaultWorkflow }),
    ...(summaryModel === undefined ? {} : { summaryModel }),
  };

  await mkdir(dirname(configPath), { recursive: true });
  await withFileMutationQueue(configPath, async () => {
    const temporaryPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(serializedConfig, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, configPath);
      if (process.platform !== "win32") {
        await chmod(configPath, 0o600);
      }
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  });
}

function isModelReference(value: string): boolean {
  const normalized = value.trim();
  const slash = normalized.indexOf("/");
  return slash > 0 && slash < normalized.length - 1 && !/\s/u.test(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
