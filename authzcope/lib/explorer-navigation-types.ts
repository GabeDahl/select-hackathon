import type { TargetRef } from "./authorization-model-types.ts";

export type NavigationTarget = TargetRef;
export type NavigationCommand =
  | { type: "overview" }
  | { type: "perspective"; perspective: "user" | "resource" }
  | { type: "focus"; target: NavigationTarget }
  | { type: "highlight"; targets: NavigationTarget[] }
  | { type: "inspect"; target: NavigationTarget }
  | { type: "compare"; patternId: string; scenarioIds: string[] };

export type NavigationEntry = {
  target: NavigationTarget;
  label: string;
  patternIds: string[];
};
export type NavigationPattern = {
  id: string;
  actor: NavigationTarget;
  resource: NavigationTarget;
  scenarioIds: string[];
};
export type NavigationRegistry = {
  revision: string;
  mode: "empty" | "analysis";
  entries: NavigationEntry[];
  patterns: NavigationPattern[];
};
export type ExplorerNavigation = {
  perspective: "user" | "resource";
  view: "overview" | "focus" | "compare";
  focus: NavigationTarget | null;
  highlighted: NavigationTarget[];
  inspected: NavigationTarget | null;
  patternId: string | null;
  scenarioIds: string[];
};
export type NavigationBatch = { revision: string; commands: NavigationCommand[] };
export type NavigationResult =
  | { ok: true; navigation: ExplorerNavigation }
  | { ok: false; message: string };
