// Generated from docs/authorization-model.schema.json.
// Run node scripts/generate-authorization-types.mjs after changing the contract.

export type Id = string;

export type Scalar = string | number | boolean | null;

export type EvidenceRef = {
  sourceId: string;
  pointer: string;
};

export type Claim = {
  id: Id;
  statement: string;
  basis: "implemented" | "intended" | "assumption" | "test_observed";
  support: "direct" | "inferred" | "unresolved" | "conflicting";
  evidenceRefs: Array<EvidenceRef>;
};

export type Attribute = {
  id: Id;
  label: string;
  key: string;
  valueType: "string" | "number" | "boolean" | "reference" | "json";
  sourceIds: Array<string>;
  claimIds: Array<Id>;
};

export type EntityType = {
  id: Id;
  label: string;
  pluralLabel: string;
  capabilities: Array<"actor" | "resource" | "context" | "relationship_record">;
  sourceIds: Array<string>;
  attributes: Array<Attribute>;
  claimIds: Array<Id>;
};

export type Participant = {
  key: string;
  label: string;
  entityTypeId: Id;
};

export type RelationshipType = {
  id: Id;
  label: string;
  participants: Array<Participant>;
  recordEntityTypeId: Id | null;
  sourceIds: Array<string>;
  visualPurpose: "grouping" | "access" | "context";
  claimIds: Array<Id>;
};

export type Action = {
  id: Id;
  label: string;
  crud: "create" | "read" | "update" | "delete" | null;
  targetEntityTypeId: Id;
  targetLevel: "instance" | "collection";
  createsEntityTypeId: Id | null;
  claimIds: Array<Id>;
};

export type Binding = {
  name: string;
  entityTypeId: Id;
};

export type Selector = {
  id: Id;
  label: string;
  entityTypeId: Id;
  kind: "type" | "symbolic" | "observed_instance";
  contextBindings: Array<Binding>;
  whereConditionId: Id | null;
  instanceEvidenceRef: EvidenceRef | null;
  claimIds: Array<Id>;
};

export type Variable = {
  id: Id;
  label: string;
  bindingRef: string;
  valueType: "string" | "number" | "boolean";
  nullable: boolean;
  choices: Array<{
  value: Scalar;
  label: string;
}>;
  source: "attribute" | "relationship_fact" | "request_context" | "external_fact";
  claimIds: Array<Id>;
};

export type Condition = {
  id: Id;
  kind: "constant";
  value: boolean;
  claimIds: Array<Id>;
} | {
  id: Id;
  kind: "all" | "any";
  conditionIds: Array<Id>;
  claimIds: Array<Id>;
} | {
  id: Id;
  kind: "not";
  conditionId: Id;
  claimIds: Array<Id>;
} | {
  id: Id;
  kind: "compare";
  variableId: Id;
  operator: "eq" | "ne" | "in" | "not_in";
  values: Array<Scalar>;
  claimIds: Array<Id>;
} | {
  id: Id;
  kind: "opaque";
  summary: string;
  bindingRefs: Array<string>;
  claimIds: Array<Id>;
};

export type ImplementationBinding = {
  sourceId: string;
  mechanism: "grant" | "policy" | "helper" | "view" | "trigger" | "application" | "external";
  phase: "invocation" | "visibility" | "old_row" | "new_row" | "column" | "not_applicable";
};

export type Rule = {
  id: Id;
  label: string;
  basis: "implemented" | "intended";
  actorSelectorId: Id;
  targetSelectorId: Id;
  actionId: Id;
  eligibilityConditionId: Id;
  implementationBindings: Array<ImplementationBinding>;
  coverage: "complete" | "partial" | "unknown";
  claimIds: Array<Id>;
};

export type Path = {
  id: Id;
  label: string;
  ruleId: Id;
  eligibilityConditionId: Id;
  relationshipTypeIds: Array<Id>;
  selectorIds: Array<Id>;
  claimIds: Array<Id>;
};

export type ScenarioFact = {
  variableId: Id;
  value: Scalar;
  basis: "observed" | "assumed";
  evidenceRefs: Array<EvidenceRef>;
};

export type Scenario = {
  id: Id;
  label: string;
  kind: "symbolic" | "observed" | "hypothetical";
  actorSelectorId: Id;
  targetSelectorId: Id;
  facts: Array<ScenarioFact>;
  claimIds: Array<Id>;
};

export type ScenarioSpace = {
  id: Id;
  label: string;
  actorSelectorId: Id;
  targetSelectorId: Id;
  fixedFacts: Array<ScenarioFact>;
  varyingVariableIds: Array<Id>;
  scenarioIds: Array<Id>;
  coverage: "exhaustive" | "representative" | "unknown";
  boundary: string;
  claimIds: Array<Id>;
};

export type PathState = {
  pathId: Id;
  state: "satisfied" | "unsatisfied" | "unknown";
};

export type Decision = {
  outcome: "allowed" | "denied" | "unknown";
  method: "symbolic_derivation" | "model_inference" | "runtime_observation" | "test_evidence";
  pathStates: Array<PathState>;
  unresolvedConditionIds: Array<Id>;
  claimIds: Array<Id>;
};

export type Evaluation = {
  id: Id;
  scenarioId: Id;
  implemented: Decision;
  intended: Decision | null;
};

export type Pattern = {
  id: Id;
  label: string;
  actorSelectorId: Id;
  targetSelectorId: Id;
  actionId: Id;
  implementedRuleIds: Array<Id>;
  intendedRuleIds: Array<Id>;
  pathIds: Array<Id>;
  scenarioSpaceId: Id;
  classification: "always" | "conditional" | "never" | "unknown";
  completeness: "complete" | "partial" | "unknown";
  currentEvaluationId: Id | null;
  evaluations: Array<Evaluation>;
  sidebarSummary: string;
  claimIds: Array<Id>;
};

export type TargetRef = {
  kind: "entity_type" | "relationship_type" | "action" | "selector" | "variable" | "condition" | "rule" | "path" | "pattern" | "scenario" | "scenario_space" | "group";
  id: Id;
};

export type FacetOption = {
  id: Id;
  label: string;
  refs: Array<TargetRef>;
};

export type Facet = {
  id: Id;
  label: string;
  dimension: "actor" | "action" | "scope" | "relationship" | "state" | "access";
  effect: "filter" | "perspective";
  multiple: boolean;
  contextBindings: Array<Binding>;
  options: Array<FacetOption>;
  defaultOptionIds: Array<Id>;
  claimIds: Array<Id>;
};

export type ScenarioControl = {
  id: Id;
  label: string;
  effect: "simulate";
  variableId: Id;
  scenarioSpaceIds: Array<Id>;
  options: Array<{
  value: Scalar;
  label: string;
}>;
  claimIds: Array<Id>;
};

export type Group = {
  id: Id;
  label: string;
  selectorIds: Array<Id>;
  relationshipTypeIds: Array<Id>;
  claimIds: Array<Id>;
};

export type Perspective = {
  id: Id;
  label: string;
  kind: "actor" | "resource";
  anchorSelectorId: Id;
};

export type Presentation = {
  groups: Array<Group>;
  perspectives: Array<Perspective>;
  defaultPerspectiveId: Id;
  overviewGroupIds: Array<Id>;
  overviewPatternIds: Array<Id>;
  defaultActionIds: Array<Id>;
  defaultScenarioId: Id | null;
};

export type Finding = {
  id: Id;
  label: string;
  kind: "intent_mismatch" | "uncertainty" | "missing_context";
  subjectRefs: Array<TargetRef>;
  explanation: string;
  claimIds: Array<Id>;
};

export type Coverage = {
  analyzedObjectIds: Array<string>;
  externalDependencyIds: Array<string>;
  exclusions: Array<{
  sourceId: string;
  reason: string;
}>;
  missingInputs: Array<string>;
  limits: Array<string>;
};

export type AuthorizationModel = {
  schemaVersion: "authzcope.authorization-model.v1-draft";
  modelId: Id;
  snapshotRevision: string;
  contextRevision: string | null;
  materialization: "types" | "symbolic" | "observed";
  coverage: Coverage;
  claims: Array<Claim>;
  entityTypes: Array<EntityType>;
  relationshipTypes: Array<RelationshipType>;
  actions: Array<Action>;
  selectors: Array<Selector>;
  variables: Array<Variable>;
  conditions: Array<Condition>;
  rules: Array<Rule>;
  accessPaths: Array<Path>;
  scenarios: Array<Scenario>;
  scenarioSpaces: Array<ScenarioSpace>;
  accessPatterns: Array<Pattern>;
  facets: Array<Facet>;
  scenarioControls: Array<ScenarioControl>;
  presentation: Presentation;
  findings: Array<Finding>;
};
