"use server";

import { validateAiSettings } from "@/lib/ai-connection";
import { testAiConnection } from "@/lib/ai-service";
import type { AiConnectionInput, AiConnectionResult } from "@/lib/ai-connection-types";

export async function configureAi(input: AiConnectionInput): Promise<AiConnectionResult> {
  return validateAiSettings(input);
}

export async function verifyAiConnection(input: AiConnectionInput): Promise<AiConnectionResult> {
  return testAiConnection(input);
}
