import assert from "node:assert/strict";
import { test } from "node:test";
import { compactAnalysisFixture } from "./analysis-fixtures.mjs";
import { compileAnalysis } from "../lib/analysis-authoring.ts";
import { compileSemanticGraph } from "../lib/scene-graph.ts";
import { projectScene } from "../lib/scene-projection.ts";
import { layoutScene } from "../lib/scene-layout.ts";
import { createModelNavigationRegistry, initialExplorerNavigation } from "../lib/explorer-navigation.ts";
import { createExplorerStore } from "../lib/explorer-store.ts";

function multiResourceModel() {
  const { wire, prepared } = compactAnalysisFixture();
  wire.entities.push(
    { ...wire.entities[1], id: "protocol", label: "Protocol" },
    { ...wire.entities[1], id: "archive", label: "Archive" },
  );
  wire.selectors.push(
    { ...wire.selectors[1], id: "protocol", entity: "protocol", label: "Protocol" },
    { ...wire.selectors[0], id: "reviewer", label: "Reviewer" },
  );
  wire.access.push({ ...wire.access[0], id: "review-protocol", actor: "reviewer", target: "protocol", paths: [], scenarios: [] });
  return compileAnalysis(wire, prepared);
}

test("root overview includes resources without access analysis for its actor, with unknown connections", () => {
  const model = multiResourceModel(), graph = compileSemanticGraph(model);
  const projection = projectScene(graph, initialExplorerNavigation);
  const panel = projection.panels[0];
  const resources = panel.nodes.filter((node) => node.role === "resource");
  assert.deepEqual(resources.map((node) => node.label).sort(), ["Archive", "Protocol", "Specimen"]);
  for (const label of ["Archive", "Protocol"]) {
    const resource = resources.find((node) => node.label === label);
    const edge = panel.edges.find((edge) => edge.toId === resource.instanceId);
    assert.equal(edge.access, "unknown");
    assert.deepEqual(edge.evaluations, []);
  }
});

test("returning from resource, path and scenario drill-down restores the entire root scene and layout", () => {
  const model = multiResourceModel(), graph = compileSemanticGraph(model);
  const registry = createModelNavigationRegistry(model);
  const pattern = registry.patterns[0];
  const originalModel = structuredClone(model);
  const root = projectScene(graph, initialExplorerNavigation), rootLayout = layoutScene(root);
  const cases = [
    [{ type: "focus", target: pattern.resource }],
    [{ type: "focus", target: { kind: "pattern", id: pattern.id } }],
    [{ type: "inspect", target: { kind: "path", id: model.accessPaths[0].id } }],
    [{ type: "compare", patternId: pattern.id, scenarioIds: pattern.scenarioIds }],
  ];
  for (const commands of cases) {
    const store = createExplorerStore(registry, () => null, async () => { throw new Error("Navigation must not call AI"); });
    assert.equal(store.getState().navigate({ revision: registry.revision, commands }).ok, true);
    const drillDown = projectScene(graph, store.getState().navigation);
    assert.ok(drillDown.panels.every((panel) => panel.nodes.filter((node) => node.role === "resource").length === 1));
    assert.equal(store.getState().navigate({ revision: registry.revision, commands: [{ type: "overview" }] }).ok, true);
    assert.deepEqual(store.getState().navigation, initialExplorerNavigation);
    const restored = projectScene(graph, store.getState().navigation);
    assert.deepEqual(restored, root);
    assert.deepEqual(layoutScene(restored), rootLayout);
  }
  assert.deepEqual(model, originalModel, "Navigation must not change authorization facts");
});
