export type ScenePoint = [number, number, number];
export type AccessStatus = "allowed" | "blocked" | "unknown";
export type AccessLevel = "full" | "limited" | "none" | "unknown";
export type AccessComplexity = "straightforward" | "conditional" | "unresolved";
export type SceneView = "overview" | "focus" | "compare";

export type SceneAction = {
  id: string;
  label: string;
  symbol: string;
  status: AccessStatus;
  scenarioSensitive?: boolean;
};

// Rendering colors only. Domain state is supplied to the primitives by callers.
export const sceneColors = {
  resource: "#ddd5c5",
  actor: "#e8decc",
  allowed: "#a5c5ac",
  blocked: "#778188",
  unknown: "#b3aec7",
  selected: "#e1a58a",
  ground: "#202a30",
  full: "#a5c5ac",
  limited: "#cfb48a",
  none: "#778188",
  conditional: "#a8a4bd",
};
