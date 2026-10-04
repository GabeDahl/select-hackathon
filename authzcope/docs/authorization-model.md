# Authorization model response contract

Status: v1 draft integrated into the schema-to-AI analysis call. The Analysis page
inspects accepted models. A deterministic selector-based scene compiler now connects
accepted models to the explorer; that integration is awaiting manual testing.
Live permission evaluation remains deferred; symbolic checks verify internal
consistency of the model, not SQL truth. See [scene components](scene-components.md)
for the projection and rendering boundary.

The response describes application meaning and authorization logic. The renderer
uses it to place selectable resources, reveal access paths, populate action markers,
and construct navigation controls. The right sidebar presents its claims and
evidence. Coordinates, meshes, colors, camera animation and collision handling belong
to the renderer.

- [JSON Schema](authorization-model.schema.json): complete accepted model shape.
- [SaaS example](authorization-model.example.json): symbolic cases grounded in the
  existing six-table example and its independently authored access documentation.

The provider uses the compact semantic authoring schema in
`lib/analysis-authoring.ts`. The server compiles that response into this complete
representation and runs full contract and semantic validation locally. Provider
rejections distinguish schema, context, model, and known setting errors using safe
application-owned messages.

## Input and the schema-only boundary

The current `DatabaseSnapshot` in `lib/catalog-types.ts` contains catalog objects,
original reconstructed definitions, dependencies, coverage notes and a content
revision. It deliberately contains no application rows. Its object IDs are
`kind:identity`, for example `relation:public.documents`. Preserve these exact IDs.
Do not substitute invented OIDs, shorten routine signatures or fabricate missing
dependencies.

The server supplies compact evidence keyed by short source aliases, omission
counts and a schema-only boundary. Original catalog IDs, revisions, dependency
graphs and provenance envelopes remain local. Optional application text is registered as
`context:application` with pointer `/text`. No repository files are automatically
attached to arbitrary connected databases. The broader input design remains:

```text
snapshot                  Original DatabaseSnapshot, including coverage
selectedScope             Included/excluded catalog IDs and reasons
evidenceRegistry          Registered sources and resolvable JSON Pointers
contextRevision           Server-computed revision of supporting evidence/context
supportingEvidence        Supplied application code, docs, tests, observations
confirmedCorrections      Previously confirmed domain corrections
previousModel             Accepted semantic IDs and their source bindings, if any
questionOrTask            Requested analysis scope
```

Catalog objects can be registered under their existing IDs with pointers such as
`/definition`, `/comment`, `/details/using`, `/details/withCheck`, or `/details/grants`.
Supporting files can use server-registered IDs such as
`repo:saas-app/docs/access-model.md` and a `/text` pointer. Every source reference must
resolve to this input; SQL or documentation is evidence, not instructions. The
connection string and AI key are not part of this envelope.

Supabase schema contents often represent generated platform machinery. The input
preserves definitions but adds provisional `originHint` and `scopeReason` fields.
Identity functions, role/grant prerequisites and platform access paths can explain
authorization without becoming business resources. Custom policies on platform
tables still matter. An origin hint cannot establish that SQL is unmodified or
justify discarding relevant implementation evidence.

With only metadata, render entity types or explicitly symbolic resources. Actual
people, document titles, instances, counts, memberships and shares require supplied
instance evidence. A schema describing a share table does not establish that a
particular document has been shared. Missing facts stay unknown.

The example uses repository sources registered under `/text`, a placeholder
snapshot revision and no catalog objects. It is a hand-authored response fixture,
not the output of a live database scan. It deliberately has no current evaluation
or default scenario. Its six hypothetical cases become visible only when selected.

## Response sections

| Section | Responsibility |
| --- | --- |
| `coverage` | Objects analyzed, retained external dependencies, exclusions, missing inputs and limits |
| `claims` | Domain statements with implemented/intended/assumption/test basis and exact source references |
| `entityTypes` | Domain actors, resources, context and inspectable relationship records, mapped to evidence |
| `relationshipTypes` | Named, potentially multi-participant relationships; grouping and authorization are separate meanings |
| `actions` | Application verbs and their targets; optional CRUD mapping supports action markers |
| `selectors` | Type, symbolic, or observed-instance selections, including resource-scoped roles |
| `variables` | Named facts that an observation or scenario may supply |
| `conditions` | A shared Boolean graph retaining opaque predicates when necessary |
| `rules` | Actor/target/action eligibility, implementation phases, evidence basis and coverage |
| `accessPaths` | Inspectable alternative explanations with their own full eligibility conditions |
| `scenarios` / `scenarioSpaces` | Specific fact assignments and the explicit boundary for comparison |
| `accessPatterns` | Per-action summaries, scoped classifications, evaluations and sidebar text |
| `facets` / `scenarioControls` | Navigation filters and hypothetical changes with different effects |
| `presentation` | Semantic groups, actor/resource perspectives and initial visible references |
| `findings` | Evidence gaps, uncertainty and independently supported intent mismatches |

Structural enums are fixed; application nouns, relationships, roles and actions are
open. A relationship may have more than two participants. Its participants are named
by domain role rather than assumed `user_id` or tenant columns. Membership and share
tables are examples, not required patterns.

An entity can be both a resource and a relationship record: a membership may itself
be readable or editable. One concept may map to multiple sources, and one source may
support multiple concepts. Semantic group membership can overlap.

## IDs, revisions and evidence

All semantic objects have namespaced IDs, such as `entity:document`,
`relationship:document-share` and `action:edit-document`. The canvas, inspector,
controls and future navigation responses reference the same IDs. Labels can change
without changing identity.

The server supplies and checks `snapshotRevision` and `contextRevision`. A model
proposal does not establish stable identity by itself. Reuse accepted IDs from
`previousModel`; on first analysis, reconcile source bindings and semantic keys in
an application-owned ID registry. Source renames need explicit reconciliation.
Keep rendering positions keyed to those accepted IDs rather than regenerated labels.

Every semantic object links to `claimIds`; claims link to registered evidence. Keep
original SQL in the snapshot, not a rewritten SQL substitute in the response.
`support: inferred` is an interpretation, not verification. Human confirmations
are application-owned overlays, and `test_observed` requires supplied test evidence.

Implemented and intended rules are distinct objects with distinct claims. With only
SQL evidence, intended behavior is unavailable. Do not infer the specification from
the implementation or report an intent mismatch without independent intent evidence.

## Actions and scoped roles

Each action states its target entity type and whether it acts on an instance or
collection. `crud` is optional: share, publish or approve can remain domain actions.
“Create document” can target a project instance and declare
`createsEntityTypeId: entity:document`; it does not attach to a nonexistent document.
Alternatively an application may define creation on a collection.

Selectors carry named context bindings. A project-viewer selector is a user selector
bound to a project and organization, not a global viewer role. Resolve those bindings
before claiming instance access. Empty permissions for an unmodeled action mean
unknown, not denied; the example defines create/delete/share actions without claiming
their effective access is analyzed.

## Conditions and authorization composition

Conditions form an acyclic graph with `all`, `any`, `not`, scalar comparisons,
constants and `opaque` nodes. Scalar variables can describe arbitrary attributes,
relationship-derived facts or request context. A condition can reference another
condition by ID, preserving shared prerequisites without enumerating every
combination or expanding the whole model into disjunctive normal form.

An absent variable assignment is unknown. An explicitly known null is a value,
for example an observation establishing no direct share. Neither missing data nor
an inaccessible row implies a negative relationship fact. Comparisons use normalized
domain facts, not an attempt to reproduce SQL null semantics.

Example normalized edit condition:

```text
authenticated
AND live organization membership
AND old document is not archived
AND (organization admin OR project editor OR direct editor share)
AND all other required execution/transition checks
```

Each share/admin/editor path must retain the shared membership and state constraints.
Paths are visual explanations; the rule's full eligibility graph governs the modeled
decision. The relationship graph alone is not a permission evaluator.

`implementationBindings` identifies grant, policy, helper, view, trigger, application
and external evidence, including invocation, visibility, old-row, new-row and column
phases. Preserve SQL's actual composition: privileges, SELECT prerequisites,
permissive/restrictive policy combinations, role applicability, UPDATE `USING` and
`WITH CHECK`, allowed columns, helper privileges and bypass/access paths matter.
Unresolved code or paths produce partial coverage and opaque conditions, not a
confident denial based on the absence of a visible allow path.

For example, the current document UPDATE policy checks editability of the **old**
row and readability of the **new** row. That permits an eligible editor to archive
content; requiring the new row to remain non-archived would misrepresent the policy.

The integration evaluates safe logical/comparison nodes against explicit symbolic
facts to check returned scenario decisions. Arbitrary SQL, application code and opaque
nodes require an appropriate evaluator or remain unknown. Never execute generated
SQL or JavaScript merely to evaluate a proposed condition.

## Decisions, patterns and scenarios

Keep these dimensions separate:

| Field | Meaning |
| --- | --- |
| `evaluation.*.outcome` | Allowed, denied or unknown in one explicitly bound scenario |
| `classification` | Always, conditional, never or unknown across the named scenario space |
| `pathStates` | Which alternative paths are satisfied, unsatisfied or unresolved in that scenario |
| `completeness` and claim support | Limits and evidence strength of the analysis |

`always` and `never` require exhaustive support within the stated boundary, not
merely a few examples. A partial or opaque analysis must not imply universal access
or denial. `conditional` can be supported by evidenced allowed and denied cases even
when the wider space has not been exhaustively explored. Unclassified conditions
remain inspectable as unknown. None of these classifications grants permission.

The baseline current decision stays unknown unless an observed context is available.
`currentEvaluationId: null` means no current decision is supplied. Selecting a
symbolic or hypothetical scenario shows its own marked evaluation; it must not
silently become observed current access.

Scenario spaces identify fixed facts, varying variables, case IDs, coverage and a
plain-language boundary. Controls change the underlying variables, not independent
derived conditions: selecting `state = archived` updates every condition that uses
state. This avoids contradictory “archived” and “not archived” toggles.

Observed facts must cite supplied observations. Assumed facts are explicit. The SaaS
example holds other client checks satisfied as an assumption and only derives
logical outcomes under that assumption. It does not claim actual SQL execution.
An arbitrary new combination may require a new evaluation; lack of a precomputed
case is not denial. Conflicting assignments or unsupported combinations need a
visible unresolved result or input correction.

## UI and 3D interpretation

The default actor view uses the accepted third-person outward camera and resource
fan. The renderer resolves symbolic or observed nodes, positions semantic groups,
and shows effective-access connections to all displayed resources. Selection exposes
the relevant `accessPaths`; resource and actor perspectives share pattern IDs.

Action markers attach to resources or appropriate parent/collection targets. Use
current outcomes for marker fill, scenario sensitivity for a separate outer mark,
and selection for highlighting. Unknown should have its own appearance. Multiple
paths are a separate visual attribute from conditional access.

`presentation` suggests groups and visible references; it does not prescribe
coordinates or force one hierarchy. Persistent layout, spacing, route separation,
occlusion, camera movement and visual state conventions stay deterministic in the
renderer. The sidebar uses `sidebarSummary`, claims, conditions and source references
without adding explanation cards to the canvas.

`facets.effect = filter` changes what is drawn or listed, with no access recalculation.
`perspective` changes the selected actor/resource lens. Scenario controls are separate
objects with `effect = simulate`, explicitly changing hypothetical facts and requesting
a fresh evaluation. Filtering out memberships must not remove their permissions.

Facet options point to semantic IDs. They may be scoped and can be derived from roles,
relationships, states or domain groupings present in the evidence. They are navigation
suggestions, not executable component descriptions, arbitrary expressions or a request
to precompute the Cartesian product of all controls.

Future natural-language navigation should use a small application-owned command
protocol against an accepted model, for example:

```json
{
  "modelId": "model:saas-symbolic-example",
  "snapshotRevision": "example-not-a-live-snapshot",
  "commands": [
    { "type": "set_perspective", "perspectiveId": "perspective:actor" },
    { "type": "focus", "selectorId": "selector:document" },
    { "type": "select_action", "actionId": "action:read-document" },
    { "type": "highlight_paths", "pathIds": ["path:read-project", "path:read-share"] }
  ]
}
```

That is an illustrative follow-up protocol, not a second implemented schema.
The UI resolves symbolic selectors before moving the camera; it validates target IDs
and current revisions. A scenario change is an explicit simulation command, never
an implicit side effect of focus or filtering.

## Runtime acceptance checks

JSON Schema validates shape, not semantic truth. The application must additionally:

1. Match the requested snapshot/context revisions and selected scope; reject stale
   results and account explicitly for retained external authorization dependencies.
2. Resolve every semantic and evidence reference, validate pointers and reject
   duplicate IDs, dangling refs and condition cycles.
3. Check rule action/target compatibility, selector context bindings, variable
   types/choices, unique scenario assignments and fixed/varying-fact consistency.
4. Require observed instances/facts and test claims to have corresponding input
   evidence; keep confirmed corrections separate from model assertions.
5. Validate scenario outcomes and path states using a supported derivation or
   evidence; flag model-only claims as inference. Unknown children follow
   three-valued logic (`false AND unknown = false`; `true OR unknown = true`).
6. Ensure current decisions refer to observed context; check classification bounds
   and distinguish missing action analysis from explicit denial.
7. Never change access results when applying a display facet. Re-evaluate all
   affected conditions for a simulation, preserve layout IDs and expose missing facts.

The full JSON Schema is enforced with AJV after compiling the compact provider
response. Tests exercise OpenAI Responses, Anthropic's structured tool
fallback and Google structured output with mocked HTTP responses. This establishes
adapter behavior, not live model quality or every model's schema support.

`lib/analysis-service.ts` resolves AI settings, recollects read-only metadata and
rejects a changed snapshot before requesting generation. `lib/analysis-input.ts`
uses `lib/analysis-evidence.ts` to select application tables, policies, helpers,
constraints, custom triggers, views and grants. It retains referenced authorization
helpers and role inheritance, including schema-qualified references in routine
definitions that catalog dependencies may miss. Platform-origin objects promoted
by older catalog snapshots cannot seed a new dependency crawl. Referenced platform
relations do not import their attached constraints, triggers or indexes; explicit
scope inclusion can still request those objects. Platform policies remain evidence.
Internal triggers and indexes are omitted by default. Named-reference matching is
conservative metadata selection, not SQL interpretation or proof of completeness;
unqualified and dynamic references can remain unresolved.

The full catalog dependency graph is never serialized into the model prompt.
Detailed omissions remain server-side: the prompt supplies schema/count summaries,
and the compiler supplies full coverage before validating the canonical model.
Browser responses omit detailed exclusions, which follow-up chat restores locally
before validation. Full snapshot evidence remains inspectable on the Schema page.
Evidence is projected once under short aliases: SQL definitions, application
columns and relevant authorization metadata, without repeated SQL/ACL envelopes
or referenced platform table columns. The model authors entities, relationships,
selectors, variables, shared conditions and effective access entries. Canonical
IDs, claims, actions, patterns, perspectives, controls and hypothetical outcomes
are compiled locally. Wire IDs are opaque keys; path IDs are scoped to their rule.
Evidence input including supporting context is capped at 40 KB, the compact
response at 16,000 characters, output at 4,096 tokens and generation at 120 seconds.
Follow-up chat projects the model/evidence with an 80 KB prompt and 2,048-token
response limit. There are no automatic paid
retries, generated-code execution or fallback acceptance of invalid output.

The provider request uses `streamText` with the compact structured-output contract;
the server consumes the stream and validates the compiled model before accepting
it. The UI advances to receiving the model after the first output delta. Provider
response headers have a separate 45-second deadline; generation retains its
120-second total deadline.

The browser uses `POST /api/analysis` with a stream of stage events followed by
the final validated result, independent of the Server Action queue. Progress
contains only application-owned stage names; provider text and reasoning are not
exposed. The full server pipeline is bounded at 150 seconds, with a browser
fallback at 160 seconds. Cancellation and input changes abort the provider call;
an in-progress read-only catalog query finishes under its existing driver
timeouts and cannot start generation afterwards. The UI shows elapsed time and
offers cancellation. These transport changes and regression tests are unverified,
awaiting manual testing.

The provider is keyed by transport version so a Fast Refresh update cannot retain
the old Server Action request in an existing store across the transport migration.
The obsolete action returns an explicit reload message without generating a model.
Terminal logs report request receipt, application-owned stages, elapsed time and
result codes. Request-scoped adapter diagnostics also report credential source
(environment or input), SDK entry, actual HTTP fetch entry, response status and
an allowlisted provider request ID, and generated character counts. They never
log credentials, SQL, provider messages or generated content. OpenAI requests
retain `store: false`, so saved response logs in its dashboard are disabled;
dashboard absence cannot establish that no request reached OpenAI. These streaming
changes and revised mocks remain unverified, awaiting manual testing.

Finish diagnostics include normalized finish reason and input/output/reasoning
token counts. SDK-wrapped compiler validation failures preserve safe field/graph
issues in logs and the browser response. Token-exhausted JSON and malformed JSON
have distinct messages; partial models are never accepted. Regression tests cover
reused path names, opaque wire IDs, SDK error causes and token exhaustion.

Semantic validation rejects unsupplied evidence, invalid pointers/references,
duplicate IDs, cycles, inconsistent selector/action types, invalid fact/control
assignments and contradictory symbolic outcomes. With metadata-only input, observed
selectors/facts, runtime/test decisions and current evaluations are rejected.
Intended claims require independently supplied context. Always/never requires
complete rules and a symbolic proof using only fixed facts; sampled scenarios alone
are insufficient. Conditional requires allowed and denied symbolic witnesses in
its scenario space. These checks cannot prove the model's SQL interpretation correct.

`AnalysisProvider` keeps results/context in tab memory across navigation. Schema,
scope, credentials, AI settings or context changes clear the result and discard
older responses. Display filters and source selection do not change access logic.
The current UI inspects patterns, scenarios, claims, coverage and JSON. Returned
facets/scenario controls are definitions for later interactive visualization;
persistent corrections, previous-model ID reconciliation and live observations
are still future work. Manual and chat-driven semantic navigation now feed the
scene projection; relationship participant bindings remain a future contract
extension rather than something the renderer guesses.
