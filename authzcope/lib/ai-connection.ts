import "server-only";

import { AI_PROVIDERS, type AiConfigurationStatus, type AiConnectionInput, type AiConnectionResult, type AiProvider } from "./ai-connection-types.ts";

const KEY_VARIABLES: Record<AiProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

export function isAiProvider(value: unknown): value is AiProvider {
  return AI_PROVIDERS.some((provider) => provider.id === value);
}

function environmentKey(provider: AiProvider) {
  // The legacy generic key belongs to one provider, never every provider.
  const genericProvider = process.env.AI_PROVIDER?.trim() || "openai";
  return process.env[KEY_VARIABLES[provider]]?.trim() || (
    genericProvider === provider ? process.env.AI_API_KEY?.trim() : undefined
  );
}

export function getAiConfigurationStatus(): AiConfigurationStatus {
  return { apiKeyConfigured: {
    openai: Boolean(environmentKey("openai")),
    anthropic: Boolean(environmentKey("anthropic")),
    google: Boolean(environmentKey("google")),
  } };
}

type ResolvedAiSettings = { provider: AiProvider; modelId: string; apiKey: string; credentialSource: "environment" | "input" };

// Only this server-only result contains a key. Never return it from an action.
export function resolveAiSettings(input: unknown):
  | { ok: true; settings: ResolvedAiSettings }
  | Extract<AiConnectionResult, { ok: false }> {
  const values = input && typeof input === "object"
    ? input as Partial<Record<keyof AiConnectionInput, unknown>> : {};
  const provider = values.aiProvider;
  const modelId = typeof values.aiModel === "string" ? values.aiModel.trim() : "";
  const injectedKey = isAiProvider(provider) ? environmentKey(provider) : undefined;
  const apiKey = injectedKey || (
    typeof values.aiApiKey === "string" ? values.aiApiKey.trim() : ""
  );
  const fieldErrors: Partial<Record<keyof AiConnectionInput, string>> = {};
  if (!isAiProvider(provider)) fieldErrors.aiProvider = "Choose a supported AI provider.";
  if (!modelId || modelId.length > 200 || /[\r\n\u0000]/.test(modelId)) {
    fieldErrors.aiModel = "Enter a model identifier of up to 200 characters.";
  }
  if (!apiKey || apiKey.length > 8_192 || /[\r\n\u0000]/.test(apiKey)) {
    fieldErrors.aiApiKey = "Provide an AI API key, or configure one for this provider on the server.";
  }
  if (!isAiProvider(provider) || Object.keys(fieldErrors).length) {
    return { ok: false, message: "Check the AI settings.", fieldErrors };
  }
  return { ok: true, settings: { provider, modelId, apiKey, credentialSource: injectedKey ? "environment" : "input" } };
}

// No network request: configuring settings must not incur provider charges.
export function validateAiSettings(input: unknown): AiConnectionResult {
  const result = resolveAiSettings(input);
  return result.ok ? { ok: true, stage: "settings" } : result;
}
