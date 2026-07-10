// TokenLab tests cover index plugin behavior.
import { describe, expect, it } from "vitest";
import plugin from "./index.js";
import { projectTokenLabModel } from "./provider-catalog.js";

type RegisteredProvider = {
  id: string;
  label: string;
  envVars?: string[];
  auth?: Array<{ id: string }>;
  staticCatalog?: { run: (ctx: unknown) => Promise<unknown> };
  resolveDynamicModel?: (ctx: { modelId: string }) => unknown;
};

function registerTokenLabProvider(): RegisteredProvider {
  let registered: RegisteredProvider | undefined;
  plugin.register({
    registerProvider: (provider: RegisteredProvider) => {
      registered = provider;
    },
    registerModelCatalogProvider: () => undefined,
  } as never);
  if (!registered) {
    throw new Error("TokenLab provider was not registered");
  }
  return registered;
}

function requireCatalogProvider(
  result:
    | {
        provider: {
          baseUrl?: string;
          models?: Array<{ id: string; compat?: { supportsTools?: boolean } }>;
        };
      }
    | { providers: Record<string, unknown> }
    | null
    | undefined,
): { baseUrl?: string; models?: Array<{ id: string; compat?: { supportsTools?: boolean } }> } {
  if (!result || !("provider" in result)) {
    throw new Error("single provider catalog result missing");
  }
  return result.provider;
}

describe("tokenlab provider plugin", () => {
  it("registers TokenLab as an OpenAI-compatible provider", async () => {
    const provider = registerTokenLabProvider();

    expect(provider.id).toBe("tokenlab");
    expect(provider.label).toBe("TokenLab");
    expect(provider.envVars).toEqual(["TOKENLAB_API_KEY"]);
    expect(provider.auth?.map((method) => method.id)).toEqual(["api-key"]);

    const result = await provider.staticCatalog?.run({
      config: {},
      env: {},
      resolveProviderApiKey: () => ({}),
    } as never);
    const catalogProvider = requireCatalogProvider(result);
    expect(catalogProvider.baseUrl).toBe("https://api.tokenlab.sh/v1");
    expect(catalogProvider.models?.map((model) => model.id)).toContain("gpt-5.5");
    expect(catalogProvider.models?.map((model) => model.id)).toContain("qwen3.7-max");
    expect(
      catalogProvider.models?.find((model) => model.id === "qwen3.7-max")?.compat?.supportsTools,
    ).toBe(false);

    expect(provider.resolveDynamicModel?.({ modelId: "future-model" } as never)).toMatchObject({
      id: "future-model",
      provider: "tokenlab",
      baseUrl: "https://api.tokenlab.sh/v1",
      api: "openai-completions",
    });
  });

  it("projects public TokenLab catalog metadata into OpenClaw model fields", () => {
    expect(
      projectTokenLabModel({
        id: "future-vision-model",
        object: "model",
        tokenlab: {
          category: "chat",
          capabilities: ["vision", "tool-use", "reasoning"],
          max_input_tokens: 262144,
          max_output_tokens: 65536,
          pricing: { input_per_1m: "0.25", output_per_1m: "1.5" },
          cache_pricing: { cache_read_per_1m: "0.025" },
          lifecycle: { stage: "active" },
        },
      }),
    ).toMatchObject({
      id: "future-vision-model",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 262144,
      maxTokens: 65536,
      cost: { input: 0.25, output: 1.5, cacheRead: 0.025, cacheWrite: 0 },
      compat: { supportsTools: true },
    });
  });

  it("ignores non-chat and retired catalog rows", () => {
    expect(
      projectTokenLabModel({ id: "image-model", tokenlab: { category: "image" } }),
    ).toBeNull();
    expect(
      projectTokenLabModel({
        id: "retired-chat-model",
        tokenlab: { category: "chat", lifecycle: { stage: "retired" } },
      }),
    ).toBeNull();
  });
});
