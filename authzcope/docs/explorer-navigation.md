# Agent-driven explorer navigation

The explorer has one provider-scoped Zustand store for manual interaction and AI
responses. It lives in tab memory without persistence. Rendering consumes semantic
state; the model never supplies coordinates, camera vectors, React props, or SQL.

`components/explorer-navigation-provider.tsx` exposes `useExplorerStore(selector)`
and `useExplorerStoreApi()`. `lib/explorer-navigation-types.ts` defines the contract.
`lib/explorer-navigation.ts` builds a registry from validated authorization output
and applies batches with a pure, atomic reducer.

## Commands

| Command | Effect |
| --- | --- |
| `overview` | Return to the root user overview, clearing focus, inspector, highlights and comparison. |
| `perspective` | Set `user` or `resource`. |
| `focus` | Select a typed semantic target and reveal its inspector. |
| `inspect` | Focus an existing rule, path, condition or other semantic target and highlight it. |
| `highlight` | Replace highlights with known typed targets. |
| `compare` | Focus an explicit access pattern with one to four existing scenarios from its scenario space. Two or more opens comparison. |

Every batch carries the registry revision. Targets use the authorization model's
`{ kind, id }` references, with no renderer IDs. At most eight commands and 32
highlight targets are accepted. Unknown targets, extra fields, stale revisions,
duplicate scenario IDs and cross-pattern scenario/path references reject the whole
batch. No scene state changes on failure. Focus/inspect clears comparison, so a
comparison command should follow other selection commands.

Selecting a target retains the current action only if it applies. Otherwise a
pattern is selected only when exactly one is relevant. Several possible actions
remain ambiguous; the AI must clarify or select an explicit pattern. Relationships
and rule/condition dependencies are mapped to their patterns without assuming
tenant, role or membership vocabulary.

## Calling from another agent or chat transport

An external response can drive the same store after validating the response at its
trust boundary:

```ts
const store = useExplorerStoreApi();
const { registry } = store.getState();
store.getState().navigate({
  revision: registry.revision,
  commands: [
    { type: "focus", target: { kind: "pattern", id: existingPatternId } },
    { type: "highlight", targets: [{ kind: "path", id: existingPathId }] },
  ],
});
```

This is a local integration API, not a public network/MCP endpoint. The registry is
the list of available targets to pass to an agent. The full reply schema lives in
`lib/explorer-chat-validation.ts`; replies contain `revision`, `answer`, `commands`
and known `claimIds`. A renderer maps `focus`, `highlighted` and `scenarioIds` to
its own geometry. The right inspector owns prose, claims and source evidence.

## Access questions

`app/actions/ask-explorer.ts` calls a server-only domain service using the existing
Vercel AI SDK provider infrastructure. The service uses a structured reply schema,
then validates IDs, scenario scope and supporting claim IDs locally. Partial
outputs are never executed. Questions are bounded to 4,000 characters, answers to
8,000, and conversation context to the last six successful turns.

Without an accepted analysis model, the registry is empty and Explore shows an
empty state. Its Connect button opens the shared connection modal. Access chat and
scene navigation require a model; there is no fictional preview or access-chat
request from the empty state. Importing a schema and checking an AI connection
remain separate from generating authorization output. **Analyze & explore** in
the modal starts analysis and opens Explore. When setup is ready, the empty state
also supports explicit analysis and retry, with progress and failure messages.

Analysis mode recollects a read-only schema snapshot, verifies its revision, and
revalidates the model with the original selected scope and application context
before a provider call. Credentials remain outside prompt construction. Input
data is treated as evidence, not instructions. Schema-only responses describe
symbolic selectors and scenarios; they do not establish live actors or executed
access checks. The explanation must distinguish implementation, intent, inference
and observation. Navigation validates references and internal consistency, not the
truth of generated prose or runtime permissions.

Accepted model replacement clears navigation and conversation. AI settings changes
clear conversation. Invalidated requests cannot apply later. If the user navigates
while a question is loading, the answer is retained and its commands wait behind
**Show in scene**; manual navigation is never overwritten by that delayed reply.

## Verification

`tests/explorer-navigation.test.mjs` covers atomic rejection, action/scenario scope,
registry adaptation, isolated stores, stale replies and manual interaction races.
`tests/explorer-chat.test.mjs` covers the three provider adapters with mocked SDK
responses, input/provenance validation, analysis-only boundaries, credential
exclusion and safe errors. Provider mocks do not verify model quality or live API
credentials.

Preview removal and empty-state integration have not been checked or tested, at the user's request. Synthetic navigation fixtures now live only under `tests/`.
