# TokenLab Provider for OpenClaw

Use [TokenLab](https://tokenlab.sh) models in [OpenClaw](https://openclaw.ai) through the normal OpenClaw inference loop.

The plugin uses TokenLab's OpenAI-compatible Chat Completions transport for agent execution. It refreshes chat model metadata from TokenLab's public `/v1/models` catalog, including pricing, context windows, output limits, vision support, reasoning, and tool-use capability. A curated 18-model catalog remains available when live discovery is unavailable.

## Install

```bash
openclaw plugins install @tokenlabai/openclaw-provider
openclaw onboard --tokenlab-api-key "$TOKENLAB_API_KEY"
```

Or install the npm package first:

```bash
npm install -g @tokenlabai/openclaw-provider
```

The default model is `tokenlab/gpt-5.5`. Any model ID accepted by TokenLab can also be addressed as `tokenlab/<model-id>` through OpenClaw's dynamic model resolution.

## Configuration

Set the API key before starting OpenClaw:

```bash
export TOKENLAB_API_KEY="your-tokenlab-api-key"
```

The default base URL is `https://api.tokenlab.sh/v1`. OpenClaw uses the OpenAI-compatible chat route. TokenLab also exposes native OpenAI Responses, Anthropic Messages, Gemini `generateContent`, image, video, music, 3D, audio, embeddings, rerank, translation, files, and async task endpoints for clients that support those contracts.

## Development

```bash
npm install
npm run check
npx clawhub package validate .
```

## Links

- TokenLab: <https://tokenlab.sh>
- TokenLab integration guide: <https://docs.tokenlab.sh/zh/guides/ide-sdk-compatibility>
- OpenClaw provider plugin guide: <https://docs.openclaw.ai/plugins/sdk-provider-plugins>
