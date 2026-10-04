import Ajv from "ajv";
import type { ExplorerChatReply } from "./explorer-chat-types.ts";
import type { ExplorerNavigation, NavigationRegistry } from "./explorer-navigation-types.ts";
import { applyNavigationBatch } from "./explorer-navigation.ts";

const target = {
  type: "object", additionalProperties: false, required: ["kind", "id"], properties: {
    kind: { type: "string", enum: ["entity_type", "relationship_type", "action", "selector", "variable", "condition", "rule", "path", "pattern", "scenario", "scenario_space", "group"] },
    id: { type: "string" },
  },
};
const command = (type: string, properties: Record<string, unknown> = {}) => ({
  type: "object", additionalProperties: false, required: ["type", ...Object.keys(properties)],
  properties: { type: { type: "string", enum: [type] }, ...properties },
});
// The same portable JSON schema is enforced locally for every provider.
export const explorerChatReplySchema = {
  type: "object", additionalProperties: false, required: ["revision", "answer", "commands", "claimIds"], properties: {
    revision: { type: "string" }, answer: { type: "string", maxLength: 8_000 },
    claimIds: { type: "array", maxItems: 24, items: { type: "string" } },
    commands: { type: "array", maxItems: 8, items: { anyOf: [
      command("overview"), command("perspective", { perspective: { type: "string", enum: ["user", "resource"] } }),
      command("focus", { target }), command("inspect", { target }),
      command("highlight", { targets: { type: "array", maxItems: 32, items: target } }),
      command("compare", { patternId: { type: "string" }, scenarioIds: { type: "array", maxItems: 4, items: { type: "string" } } }),
    ] } },
  },
};
const validateShape = new Ajv({ strict: false }).compile<ExplorerChatReply>(explorerChatReplySchema);
export class ExplorerChatValidationError extends Error {
  constructor() { super("The response contains invalid navigation or unsupported evidence references. Ask again."); }
}
export function validateExplorerChatReply(value: unknown, registry: NavigationRegistry, navigation: ExplorerNavigation, claimIds: string[]): ExplorerChatReply {
  if (!validateShape(value) || !value.answer.trim() || new Set(value.claimIds).size !== value.claimIds.length || value.claimIds.some((id) => !claimIds.includes(id))) throw new ExplorerChatValidationError();
  if (!applyNavigationBatch(registry, navigation, { revision: value.revision, commands: value.commands }).ok) throw new ExplorerChatValidationError();
  return value;
}
