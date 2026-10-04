import type { AnalysisInput } from "./analysis-types.ts";
import type { AuthorizationModel } from "./authorization-model-types.ts";
import type { ExplorerNavigation, NavigationBatch } from "./explorer-navigation-types.ts";

export type ExplorerChatReply = NavigationBatch & { answer: string; claimIds: string[] };
export type ExplorerChatTurn = { question: string; answer: string };
export type ExplorerChatInput = {
  question: string;
  history: ExplorerChatTurn[];
  navigation: ExplorerNavigation;
  mode: "analysis";
  analysis: AnalysisInput;
  model: AuthorizationModel;
};
export type ExplorerChatResult =
  | { ok: true; reply: ExplorerChatReply }
  | { ok: false; code: "input" | "database" | "stale_snapshot" | "invalid_output" | "provider"; message: string };
