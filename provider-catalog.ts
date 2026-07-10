// TokenLab provider module implements model/runtime integration.
import type { ProviderRuntimeModel } from "openclaw/plugin-sdk/plugin-entry";
import {
  getCachedLiveProviderModelRows,
  type LiveModelCatalogFetchGuard,
} from "openclaw/plugin-sdk/provider-catalog-live-runtime";
import type {
  ModelDefinitionConfig,
  ModelProviderConfig,
} from "openclaw/plugin-sdk/provider-model-shared";
import {
  buildTokenLabModelDefinition,
  TOKENLAB_BASE_URL,
  TOKENLAB_MODEL_CATALOG,
} from "./models.js";

const PROVIDER_ID = "tokenlab";
const TOKENLAB_MODELS_ENDPOINT = "https://api.tokenlab.sh/v1/models";
const TOKENLAB_MODELS_TIMEOUT_MS = 8_000;
const TOKENLAB_MODELS_CACHE_TTL_MS = 60_000;
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;
const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;

const staticModels = TOKENLAB_MODEL_CATALOG.map(buildTokenLabModelDefinition);
const staticModelsById = new Map(staticModels.map((model) => [model.id, model]));
const liveModelsById = new Map<string, ModelDefinitionConfig>();

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function asCost(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
  return 0;
}

function asStringSet(value: unknown): Set<string> {
  return new Set(
    Array.isArray(value)
      ? value.flatMap((item) => (typeof item === "string" ? [item.trim()] : []))
      : [],
  );
}

export function projectTokenLabModel(row: unknown): ModelDefinitionConfig | null {
  const model = asRecord(row);
  const id = asString(model?.id);
  const metadata = asRecord(model?.tokenlab);
  if (!id || !metadata || metadata.category !== "chat") {
    return null;
  }

  const lifecycle = asRecord(metadata.lifecycle);
  if (lifecycle?.stage === "retired") {
    return null;
  }

  const fallback = staticModelsById.get(id);
  const capabilities = asStringSet(metadata.capabilities);
  const pricing = asRecord(metadata.pricing);
  const cachePricing = asRecord(metadata.cache_pricing);
  const supportsTools = capabilities.has("tool-use");

  return {
    id,
    name: fallback?.name ?? id,
    reasoning: capabilities.has("reasoning") || fallback?.reasoning === true,
    input: capabilities.has("vision") ? ["text", "image"] : ["text"],
    contextWindow:
      asPositiveInteger(metadata.max_input_tokens) ??
      fallback?.contextWindow ??
      DEFAULT_CONTEXT_WINDOW,
    maxTokens:
      asPositiveInteger(metadata.max_output_tokens) ?? fallback?.maxTokens ?? DEFAULT_MAX_TOKENS,
    cost: {
      input: asCost(pricing?.input_per_1m),
      output: asCost(pricing?.output_per_1m),
      cacheRead: asCost(cachePricing?.cache_read_per_1m),
      cacheWrite: 0,
    },
    compat: {
      ...fallback?.compat,
      supportsTools,
    },
  };
}

function buildProvider(models: ModelDefinitionConfig[], apiKey?: string): ModelProviderConfig {
  return {
    baseUrl: TOKENLAB_BASE_URL,
    api: "openai-completions",
    ...(apiKey ? { apiKey } : {}),
    models,
  };
}

export function buildStaticTokenLabProvider(apiKey?: string): ModelProviderConfig {
  return buildProvider(staticModels, apiKey);
}

export async function buildTokenLabProvider(params: {
  apiKey: string;
  discoveryApiKey?: string;
  fetchGuard?: LiveModelCatalogFetchGuard;
  signal?: AbortSignal;
}): Promise<ModelProviderConfig> {
  try {
    const rows = await getCachedLiveProviderModelRows({
      providerId: PROVIDER_ID,
      endpoint: TOKENLAB_MODELS_ENDPOINT,
      apiKey: params.apiKey,
      discoveryApiKey: params.discoveryApiKey,
      fetchGuard: params.fetchGuard,
      signal: params.signal,
      timeoutMs: TOKENLAB_MODELS_TIMEOUT_MS,
      ttlMs: TOKENLAB_MODELS_CACHE_TTL_MS,
      auditContext: "tokenlab-model-discovery",
      shouldCacheRows: (items) => items.length > 0,
    });
    const models = rows
      .map(projectTokenLabModel)
      .filter((model): model is ModelDefinitionConfig => model !== null);
    if (models.length > 0) {
      liveModelsById.clear();
      for (const model of models) {
        liveModelsById.set(model.id, model);
      }
      return buildProvider(models, params.apiKey);
    }
  } catch {
    // Live discovery is advisory; preserve a usable offline provider catalog.
  }
  return buildStaticTokenLabProvider(params.apiKey);
}

export function resolveTokenLabModel(modelId: string): ProviderRuntimeModel {
  const id = modelId.trim();
  const model = liveModelsById.get(id) ?? staticModelsById.get(id) ?? {
    id,
    name: id,
    reasoning: false,
    input: ["text"] as const,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
    cost: ZERO_COST,
  };
  const input: Array<"text" | "image"> = (model.input as readonly string[]).includes("image")
    ? ["text", "image"]
    : ["text"];
  return {
    ...model,
    input,
    provider: PROVIDER_ID,
    baseUrl: TOKENLAB_BASE_URL,
    api: "openai-completions",
  };
}
