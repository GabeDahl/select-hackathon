# Scene primitives

The explorer renders resources and access paths only from an accepted authorization model. With no model, it shows an empty state whose Connect button opens the shared connection modal. Scene controls and access chat are hidden until analysis succeeds. The authored Maya/Launch brief preview, its inspector explanations, and preview chat context have been removed.

Connection checks and schema import do not generate the authorization model. The modal's **Analyze & explore** action starts the shared analysis store and returns to Explore. An existing model can be opened with **Explore model** without another AI call. The empty state exposes **Analyze authorization** when setup is ready, streamed pipeline stages with elapsed time, cancellation, and errors with a retry action. The request has server/browser deadlines and runs independently of the Server Action queue. Readiness is shared with the Analysis page through `hooks/use-analysis-readiness.ts`. This setup-to-analysis integration is awaiting manual verification; no tests, builds, or browser checks were run.

| Component | Inputs and responsibilities |
| --- | --- |
| `Resource` | Stable resource ID, optional instance ID, label, workflow state, position, rotation, dimensions, complexity, and independent selection state. Straightforward resources use a solid volume; conditional resources use three separated layers; unresolved resources use a dotted outline. No action ports appear. |
| `Actor` | Stable ID, label, and ground-level position. Renders an abstract capsule and head. |
| `Connection` | Stable ID, explicit endpoints, supplied access level and optional semantic scope, curve lift, width, opacity, and direction. Full is solid sage; limited is dashed gold; none is faint dashed grey without an arrow; unknown is dotted lavender. |
| `RelationshipJunction` | Stable relationship ID, label, position, and supplied active state. Displays access-path explanations in the focused model view. |
| `ResourceScenario` | Shared actor/resource IDs, distinct scenario ID, label, supplied access summary, and placement. Uses the same local geometry and camera for comparable renderings. |
| `AnchoredLabel` | Stable ID, label, optional detail, position, and tone. Native WebGL billboard with a canvas texture and the app's local Geist font; maintains readable screen size. |
| `AccessLegend` | Compact HTML legend for access connections and conditional resource geometry. |

`resourceConnectionAnchor` returns the resource face's world-space location using the same dimensions and rotation as `Resource`. Connection endpoints do not depend on action sockets.

Resource complexity and effective access are independent. A straightforward resource can have limited access; a conditional resource can currently grant no access. Ownership is not an access calculation. The renderer consumes a supplied summary within its declared scope; it does not derive full access from a single allowed action. Focused connections retain their explicit action scope.

Semantic IDs stay stable across overview, inspector, focus, and comparisons. Scenario resource instances have distinct scene instance IDs while preserving the shared `userData.semanticId`. Components do not infer permissions, fetch evidence, or own application selection. The older `ActionPort` primitive remains available but is not mounted in this flow.

The camera reframes when the viewport, inspector, or scene mode changes. Mouse controls allow left-drag to orbit, right-drag to pan, and scrolling to zoom around the framed scene's center. Dragging does not select entities. The scene renders on demand. Scenario comparisons use the selected model's scoped cases; symbolic results have not been evaluated against a connected database.

## Accepted-model scene compiler

Implementation added; automated checks and manual rendering have deliberately not been run for the compiler integration. `ExplorerScene` uses `ModelGraphScene` when an accepted analysis model exists, and otherwise the workspace shows its empty state without mounting a WebGL canvas. Mouse camera controls are implemented; targeted lint passed, with manual rendering still unverified.

The application owns a deterministic pipeline:

1. `lib/scene-graph.ts` / `compileSemanticGraph(model)` indexes selectors, entity types, patterns, condition dependencies, and navigation targets. A selector is the identity of a displayed symbolic or observed entity; its entity type chooses its domain category. An unrepresented entity type can have an explicitly marked type representative. These are not invented database rows.
2. `lib/scene-projection.ts` / `projectScene(graph, navigation)` selects an actor/resource lens and builds overview, focused-path, or scenario panels. Filtering and selection never change permission facts. Overview groups suggest additional symbolic resources; resources without access analysis receive unknown connections.
3. `lib/scene-access.ts` resolves accepted evaluations or safely derives an explicitly selected scenario using the existing symbolic evaluator. It merges that scenario space's fixed facts with its scenario facts and gates path conditions with their effective implemented rule. No scenario selection means observed current evidence only. Hypothetical presentation defaults are not silently selected. Model-inference outcomes remain visually unknown.
4. `lib/scene-layout.ts` / `layoutScene(projection, previousLayout?)` assigns positions and rotations. Fans use additional rings for larger models, rather than dropping resources. Focused paths use rows. Comparison panels retain the same path topology and local placement regardless of outcome; all panels share a spacing budget. Optional previous-layout positions are scoped to stable scene-instance IDs.
5. `components/scene/model-graph-scene.tsx` maps those nodes and edges to the design primitives and fits the camera to computed bounds. It supplies primitive state; primitives never interpret SQL or AI output.

`lib/scene-graph-types.ts` is the integration contract. Each node has a unique `instanceId`, its original `semanticId`, an inspectable `target`, and `refs` for related semantic targets. Edges retain action IDs, scenario/evaluation provenance, and refs. `SceneLayout.instancesByTarget` maps a `semanticTargetKey(ref)` to every visible node/edge instance, including comparison copies. Renderer wrapper groups carry these refs in `userData`; navigation uses the original semantic targets rather than object names or coordinates.

Overview access levels are scoped to their declared action IDs. Full means all of those actions are allowed, none means all are denied, and limited means a known mixture. A missing action, unresolved outcome, model inference, or conflicting result across distinct pattern scopes produces unknown. This summary does not mean unrestricted access to the resource. Resource complexity is derived independently from pattern completeness and scoped classification.

The current response supplies relationship *types*, not concrete participant bindings, and an access path's relationship list is not an ordered route. Each focused junction therefore represents one implemented **access-path explanation** between the pattern's declared actor and target. Its relationship references support highlighting and inspection; they do not instantiate membership/share rows or imply a sequence. Multi-participant relationship topology needs a future contract extension mapping participant keys to selectors, with claim and symbolic/observed provenance. Intended rules stay available to the inspector but are not painted as implemented grants.
