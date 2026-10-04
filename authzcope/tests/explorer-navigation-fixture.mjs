// Synthetic navigation targets for unit tests only.
export const testNavigationRegistry = {
  revision: "test.navigation.v1", mode: "analysis",
  entries: [
    ...[
      ["test:personal-notes", "Personal notes"], ["test:handbook", "Handbook"],
      ["test:launch-brief", "Launch brief"], ["test:research", "Research notes"], ["test:review", "Review queue"],
      ["test:maya", "Maya"],
    ].map(([id, label]) => ({ target: { kind: "selector", id }, label, patternIds: id === "test:launch-brief" || id === "test:maya" ? ["test:read"] : [] })),
    ...[
      ["test:organization-membership", "Organization membership"], ["test:project-editor", "Project editor"], ["test:viewer-share", "Viewer share"],
    ].map(([id, label]) => ({ target: { kind: "relationship_type", id }, label, patternIds: ["test:read"] })),
    ...[
      ["test:membership-path", "Organization membership path"], ["test:project-path:in", "Project editor path"],
      ["test:project-path:out", "Project editor to document"], ["test:share-path:in", "Share path"], ["test:share-path:out", "Share to document"],
    ].map(([id, label]) => ({ target: { kind: "path", id }, label, patternIds: ["test:read"] })),
    ...[
      ["test:current", "Current (illustrative)"], ["test:share-revoked", "Share revoked"], ["test:membership-removed", "Membership removed"],
    ].map(([id, label]) => ({ target: { kind: "scenario", id }, label, patternIds: ["test:read"] })),
    { target: { kind: "pattern", id: "test:read" }, label: "Maya reads Launch brief (illustrative)", patternIds: ["test:read"] },
  ],
  patterns: [{ id: "test:read", actor: { kind: "selector", id: "test:maya" }, resource: { kind: "selector", id: "test:launch-brief" },
    scenarioIds: ["test:current", "test:share-revoked", "test:membership-removed"] }],
};
