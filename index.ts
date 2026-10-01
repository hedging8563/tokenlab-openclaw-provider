// TokenLab plugin entrypoint registers its OpenClaw integration.
import { readConfiguredProviderCatalogEntries } from "openclaw/plugin-sdk/provider-catalog-shared";
import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import type { OpenClawPluginDefinition } from "openclaw/plugin-sdk/plugin-entry";
import { buildProviderReplayFamilyHooks } from "openclaw/plugin-sdk/provider-model-shared";
import { buildProviderToolCompatFamilyHooks } from "openclaw/plugin-sdk/provider-tools";
import { TOKENLAB_DEFAULT_MODEL_REF } from "./models.js";
import { applyTokenLabConfig } from "./onboard.js";
import {
  buildStaticTokenLabProvider,
  buildTokenLabProvider,
  resolveTokenLabModel,
} from "./provider-catalog.js";

const PROVIDER_ID = "tokenlab";

const plugin: OpenClawPluginDefinition = defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "TokenLab Provider",
  description: "TokenLab provider plugin with live model catalog discovery",
  provider: {
    label: "TokenLab",
    docsPath: "https://tokenlab.sh/docs/zh/guides/ide-sdk-compatibility",
    envVars: ["TOKENLAB_API_KEY"],
    auth: [
      {
        methodId: "api-key",
        label: "TokenLab API key",
        hint: "OpenAI-compatible chat plus native Responses, Anthropic Messages, and Gemini formats",
        optionKey: "tokenlabApiKey",
        flagName: "--tokenlab-api-key",
        envVar: "TOKENLAB_API_KEY",
        promptMessage: "Enter TokenLab API key",
        defaultModel: TOKENLAB_DEFAULT_MODEL_REF,
        applyConfig: (cfg) => applyTokenLabConfig(cfg),
        noteTitle: "TokenLab",
        noteMessage: [
          "Manage API keys at https://tokenlab.sh",
          "OpenClaw uses TokenLab's OpenAI-compatible chat route.",
          "TokenLab also exposes native /v1/responses, Anthropic Messages, and Gemini generateContent formats for clients that support them.",
        ].join("\n"),
        wizard: {
          choiceId: "tokenlab-api-key",
          choiceLabel: "TokenLab API key",
          groupId: PROVIDER_ID,
          groupLabel: "TokenLab",
          groupHint: "Multi-provider AI gateway",
        },
      },
    ],
    catalog: {
      order: "simple",
      run: async (ctx) => {
        const auth = ctx.resolveProviderAuth(PROVIDER_ID);
        const apiKey = auth.apiKey ?? ctx.resolveProviderApiKey(PROVIDER_ID).apiKey;
        if (!apiKey) {
          return null;
        }
        const provider = await buildTokenLabProvider({
          apiKey,
          discoveryApiKey: auth.discoveryApiKey,
        });
        const explicitBaseUrl = ctx.config.models?.providers?.[PROVIDER_ID]?.baseUrl?.trim();
        return {
          provider: explicitBaseUrl ? { ...provider, baseUrl: explicitBaseUrl } : provider,
        };
      },
      staticRun: async () => ({ provider: buildStaticTokenLabProvider() }),
    },
    resolveDynamicModel: ({ modelId }) => resolveTokenLabModel(modelId),
    augmentModelCatalog: ({ config }) =>
      readConfiguredProviderCatalogEntries({
        config,
        providerId: PROVIDER_ID,
      }),
    ...buildProviderReplayFamilyHooks({
      family: "openai-compatible",
      dropReasoningFromHistory: false,
    }),
    ...buildProviderToolCompatFamilyHooks("openai"),
  },
});

export default plugin;
