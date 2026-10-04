# AuthZcope

Authorization analysis grounded in application domain meaning and database evidence.
The example Supabase application lives separately in `../saas-app`.

## Development

Use Node.js 24 and pnpm (the version is recorded in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. The Connections page accepts a Postgres connection
URL, an AI provider/model identifier, and an AI API key. A successful database connection
imports catalog evidence into the shared workspace and the Schema page.
The Analysis page sends scoped metadata and optional application context through
the configured model and inspects a validated domain authorization contract.
The 3D visualizer remains deferred.
Use `localhost` for development. Next.js blocks dev resources from unconfigured
origins such as `127.0.0.1`; the HTML can still load while client interactions
fail to initialize. Alternate hosts require `allowedDevOrigins` configuration.

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm start
```

## UI foundation

- Next.js App Router, React, TypeScript, and Tailwind CSS v4.
- Shadcn components using Base UI primitives and the Nova source template.
- Warm ivory chrome, a graphite model canvas, coral/sage accents, and Geist fonts.
- Shared colors, fonts, and radii: `app/globals.css`.
- Editable shadcn components: `components/ui/`, including Sidebar, Sheet, Tabs,
  ToggleGroup, InputGroup, Card, Alert, and the existing form primitives. Install
  missing primitives as needed; use semantic theme tokens and shared variants.
- Class utility: `lib/utils.ts`. Import aliases use `@/`.
- Forms should compose `FieldGroup`, `Field`, `FieldLabel`, and `Input`.
- Dark tokens are available through the `.dark` class; a theme switcher is not
  implemented yet.

## App shell and routes

All pages share `components/app-shell.tsx`: a compact header, shadcn navigation
rail, a header Connections dialog trigger, and a keyboard skip link. Navigation labels and
destinations live in `lib/navigation.ts`. Reuse existing development servers;
agents must not start, restart, replace, or stop them without an explicit request.

| Route | Workspace |
| --- | --- |
| `/` | Exploration canvas and selected-item inspector |
| `/connections` | Legacy redirect to `/`; setup is in the header dialog |
| `/schema` | Database evidence and application scope |
| `/context` | Domain meaning and intended access rules |
| `/analysis` | Access explanations with supporting evidence |

The Connections dialog has database and AI setup forms. Analysis and Evidence
setup actions open the same dialog, and settings survive closing it in tab memory.
Schema inspects imported database
evidence. Context and Analysis remain navigable scaffolds with explicit
placeholder states. The explorer has resource/user perspective
controls and a sample document selected initially. Its inspector has Access,
Intent, and Evidence tabs; it docks beside the canvas on desktop and uses a
shadcn Sheet below 1024px. Close it and select the sample document to reopen it.
All inspector content is illustrative, and 3D navigation, AI questions, and
scenario comparisons are not connected yet. `ExplorerSelection` contains only
presentation metadata and does not define the future AI output representation.
Shared `PageHeader` and `ScaffoldPage` components keep the other page structures
consistent. Page entry points remain server components; interactive shell,
navigation, exploration, and connection form components run on the client.

Add components as needed rather than installing the entire library:

```sh
pnpm dlx shadcn@latest add dialog
```

## Deployment

The scaffold uses the standard Next.js build and start commands and can be
deployed to Vercel or a Node.js host. Database access runs on the Node.js server;
environment secrets must not use the `NEXT_PUBLIC_` prefix.

## Connection setup

The tracked `.env.development` connects AuthZcope to the Supabase CLI instance
running in `../saas-app`. Next.js loads it automatically for `pnpm dev`.
Its local database URL is intentionally committed; real credentials and AI keys
belong in the gitignored `.env.local` or deployment environment variables.

Optional server environment variables (for example in a gitignored `.env.local`):

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=verify-full
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key
```

Configure only the providers you use. For compatibility, `AI_API_KEY` is also
supported for the provider named by `AI_PROVIDER` (`openai` when omitted).
A provider-specific key takes precedence over that generic key, then the form
input. A key configured for one provider is never used for another provider.

Each environment credential takes precedence over its form input. Only presence
flags are sent to the browser; environment values are never rendered. Missing
credentials are entered in the form. User-entered credentials remain in page
memory and the server action's request memory without persistence, logging, or
inclusion in its response. Credentials are not restored after a page reload.

Database and AI setup use separate forms, validation, loading states, and results.
Database configuration and testing work without any AI settings.
The database card and header share status badges for missing configuration,
untested credentials, a running test, a successful test, or a failed test.
Database credentials and the last test result stay in tab memory across app
navigation and clear on reload. A verified badge reports the last test, rather
than continuous connection monitoring. Editing the URL clears the prior result.

`introspectDatabase({ connectionString? })` lives in
`app/actions/introspect-database.ts`. It validates the database URL, connects, runs
`SELECT 1`, and collects catalog evidence in one repeatable-read, read-only
transaction. It closes the connection on success or failure. Success returns
`{ ok: true, stage: "introspection", databaseSource, snapshot }`; an import failure
after connecting reports `databaseConnected: true` without driver error details.
It does not accept or validate AI settings.

Connection URLs accept `postgres://` or `postgresql://` with a username, host,
and database. The supported URL option is `sslmode=disable`, `require`, or
`verify-full`; both TLS modes verify the server certificate. No TLS is requested
when the option is absent. For the local example, use
`postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable`.

## Evidence snapshots and workspace state

`lib/catalog.ts` is the server-only collector reusable by future model-input
preparation. `lib/catalog-queries.ts` contains static catalog SQL;
`lib/catalog-types.ts` describes versioned Postgres evidence, not the future AI
domain output. Snapshots contain logical object IDs, catalog addresses, a content
revision, capture time, and explicit coverage notes. They include schemas,
relations and columns, RLS flags and policy expressions, grants (including column
privileges), helper definitions and execution settings, constraints, indexes,
triggers, views/rules, types, roles and memberships, default privileges,
extensions, operators/casts, and catalog dependency edges.

No application rows are read and no AI request is made. Full system internals
are omitted with an explicit list; references to uncollected objects retain their
catalog identities. Provider and extension objects are retained as reversible
infrastructure candidates. Unknown objects and policies are included
conservatively, and dependencies of included objects are retained in scope.
Catalog dependencies cannot prove independence: string-defined function bodies
and dynamic SQL can reference objects without a recorded edge. This evidence
does not establish effective access or business intent.

`lib/workspace-store.ts` uses Zustand with a store instance per root provider.
Typed actions handle import/refresh, credential updates, object selection,
schema filters, and scope overrides. The snapshot survives route navigation in
tab memory. There is no persistence or credential cache. Changing credentials
clears the snapshot and ignores older responses; failed refreshes keep the
previous snapshot with a visible error. Successful refreshes reconcile selection
and scope by object ID. Scope overrides are client-side analysis choices and do
not change Postgres permissions. Future questions, model results, and mutations
can add typed state/actions alongside this evidence without coupling it to a
renderer.

Collection fails explicitly above 10,000 objects, 50,000 dependency edges, or
10 MB of snapshot content. Database connections and queries have timeouts.

## AI infrastructure

Vercel AI SDK (`ai`) supplies the common generation/streaming API, usage and finish
metadata, tools, and caller-defined structured outputs. Direct adapters for
OpenAI, Anthropic, and Google handle provider protocols; no gateway account is
required. The Connections page prefills `gpt-6.1-sol` for OpenAI,
`claude-sonnet-5-5` for Anthropic, and `gemini-3.8-flash` for Google. Model IDs
remain editable so switching models does not require changes to a curated list.
Features and model availability still depend on the provider.

`lib/ai-service.ts` exports the server-only `createAiCallOptions(input)` factory.
It accepts `{ aiProvider, aiModel, aiApiKey? }`, resolves the provider's key, and
creates a request-scoped model with a 60-second total timeout and two transient
retries. SDK telemetry is disabled, streaming error logs are redacted, and OpenAI
Responses uses `store: false`.
Callers can override timeout/retry settings and supply an `abortSignal`.
No credential singleton, database access, evidence selection, system prompt, or
domain output schema is introduced.

Use the SDK directly to preserve its type inference and result metadata:

```ts
import "server-only";
import { generateText, streamText } from "ai";
import { createAiCallOptions } from "@/lib/ai-service";

// settings and messages are supplied by the future caller.
const options = createAiCallOptions(settings);
const result = await generateText({ ...options, messages, abortSignal });
// result.text, result.usage, result.finishReason, result.providerMetadata
const stream = streamText({ ...options, messages, abortSignal });
// stream.textStream; await stream.usage and stream.finishReason after consumption
```

Callers can also pass `output: Output.object({ schema })` with their chosen schema.
SDK results and errors stay server-side unless deliberately mapped to a client
response. Raw errors may contain request details; `aiErrorResult(error)` provides
safe messages at request boundaries. Streaming callers should handle errors
through the SDK's `onError` callback or the error events in `fullStream`;
`textStream` alone does not surface every error. Errors can arrive after
`streamText` returns.

The Connections page exposes separate **Check AI settings** and **Test AI
connection** buttons. `configureAi(input)` validates without a provider request.
`verifyAiConnection(input)` sends only the fixed prompt "Reply with OK." with a
128-token output cap, a 15-second timeout, and no retries; it may incur a charge.
It returns a success stage or sanitized error, never the provider response or key.
Neither action accesses the database. Verification proves a small request worked,
not that every future feature or structured output is supported.

`AiConnectionProvider` owns a Zustand store per root provider. Settings and the
last check survive navigation in tab memory and clear on reload. Changing a
provider prefills its default model and clears the key; any edit clears
verification and ignores older responses. Missing keys are entered in the form;
injected keys stay server-side.

## Authorization analysis

1. Import the database on Connections and review application scope on Schema.
2. Configure the AI provider/model and key independently.
3. Open Analysis, optionally supply domain documentation/intended behavior, and
   select **Analyze authorization**. This sends schema evidence to that provider.

The server recollects metadata and matches the imported revision before calling
the model. It preserves original definitions and dependency evidence, with
provisional hints distinguishing Supabase/platform machinery from domain logic.
The contract is validated against the canonical JSON Schema plus references,
evidence pointers, scenario consistency and provenance. Schema-only results are
symbolic, not live permission checks. SQL alone cannot establish intended rules.

Results and context survive navigation in tab memory and clear when analysis
inputs change. Failed/stale/invalid output is reported explicitly. The model-input
payload is capped at 1 MB; generation uses a 24,000-token cap, 120-second timeout
and no automatic retries. Analysis uses a cancellable POST stream with schema,
evidence, generation and validation stages plus elapsed time. The full server
pipeline has a 150-second deadline and the browser has a 160-second fallback;
cancelling or changing inputs aborts the request and ignores late results. This
transport update awaits manual verification; its added tests have not been run.
Use a model that supports structured output and has
enough context for the selected evidence. See
[`docs/authorization-model.md`](docs/authorization-model.md) for the contract and
limitations. Regenerate its TypeScript types with
`node scripts/generate-authorization-types.mjs` after changing the JSON Schema.

## Verification

`pnpm test` checks validation, secret redaction, connection cleanup, scope
classification, client state concurrency/refresh behavior, and AI adapters with
mocked HTTP responses (generation, streaming, caller-defined output, cancellation,
and timeouts), structured analysis for all three providers, contract rejection,
Supabase origin hints, and stale analysis state. It makes no paid AI requests. Set
`AUTHZCOPE_TEST_DATABASE_URL` for a real database connection/import test. Set
`AUTHZCOPE_TEST_SAAS_DATABASE_URL` for additional read-only assertions against the
local SaaS fixture's policies, column grants, helper functions, and dependencies.

See `../AGENTS.md` for shared product decisions.
