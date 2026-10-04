export const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
] as const;

export type AiProvider = typeof AI_PROVIDERS[number]["id"];

export const AI_DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-6.1-sol",
  anthropic: "claude-sonnet-5-5",
  google: "gemini-3.8-flash",
};

export type AiConfigurationStatus = {
  apiKeyConfigured: Record<AiProvider, boolean>;
};

export type AiConnectionInput = {
  aiProvider: AiProvider;
  aiModel: string;
  aiApiKey?: string;
};

export type AiConnectionResult =
  | { ok: true; stage: "settings" | "connection" }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<keyof AiConnectionInput, string>>;
    };
