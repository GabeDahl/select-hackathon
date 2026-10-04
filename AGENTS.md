# AuthZcope project context

This file is shared context for chats and coding agents working in this workspace.
Keep it concise and update it when the user changes the product direction or makes
a lasting architectural decision. Record decisions here rather than relying on
another chat's history. The user's current instructions take precedence.

## Goal

Build **AuthZcope** for a Supabase hackathon whose theme is **“build something
agents want.”** Help agents and technical and non-technical staff understand an
application's authorization model in its own domain language.

The product connects **domain intent, implemented permissions, and evidence**.
It should explain who can perform an action on a resource, under which conditions,
why that access exists, and where implementation may disagree with intended
business behavior. SQL policies and database functions are central evidence, but
application code, documentation, and tests also establish domain meaning.

The core bet is that better models will understand application semantics more
deeply. Preserve a design that benefits from that improvement. Parsing SQL and
drawing relationships alone does not deliver the intended product value.

AuthZcope must support varied application domains and arbitrary authorization
models. The workspace-and-documents SaaS example is a demonstration fixture, not
the template for ingestion or inference. Do not assume tenant boundaries,
membership tables, user ID columns, or a fixed vocabulary of roles and actions.

## Product direction

- Infer actors, resources, relationships, workflow states, and intended rules from
  evidence. Roles may depend on a user's relationship to a particular resource.
- Explain effective access through policies, helper functions, grants, and
  relevant views or other access paths; connect the result to business meaning.
- Feed introspected SQL and supporting evidence to an AI model to translate
  implemented authorization into human-understandable domain relationships and
  actions that drive the visualization. Preserve source evidence rather than
  constraining interpretation to a predefined set of SQL patterns.
- Make the explanation inspectable through a visualization usable by both
  technical and non-technical people. SQL details should be available as evidence.
- Keep UI copy minimal. Do not add decorative eyebrows, default subtitles, or
  descriptions that repeat headings, controls, or nearby text. Use text where it
  explains access, evidence, a necessary action, or a meaningful status; no text
  is often the right choice.
- Use the 3D workspace for selection and intuitive visualization of entities,
  domain relationships, and access patterns. Keep explanations, detailed rules,
  and source evidence in the right sidebar. AI-directed interaction should focus
  and highlight relevant spatial relationships without filling the canvas with
  explanatory cards or prose. Memberships and shares are example access paths,
  not a fixed vocabulary for the visualizer.
- The unselected 3D overview uses a third-person camera looking outward from
  behind the actor across relevant resources arranged in a roughly three-quarter
  circle ahead and to the sides. Show connections to all displayed resources in
  this overview; selecting a resource focuses the relevant connections. This is
  a spatial interaction direction, not a request for game styling.
  Back to overview restores the root user view and all modeled resources, clearing
  the drill-down perspective, selection and comparison. Missing access analysis
  for the overview actor must remain unknown rather than hide a resource.
- Start the overview from a user's perspective with simple effective-access
  connections to relevant resources. Resource appearance should distinguish
  straightforward access from access involving special conditions or scenarios,
  without exposing every action, condition, or granting relationship. Ownership
  is one possible domain relationship, not a universal proxy for permissions.
  Action ports were explored in the component preview but are not the selected
  overview direction. On drill-down, switch to a resource-focused scene and
  reveal relevant access paths and conditions. Multiple 3D renderings of that
  resource under different scenarios are a proposed comparison interaction;
  keep geometry and framing comparable and detailed explanations in the sidebar.
- Support two perspectives on the same authorization model: a resource view
  answering "who can read/write me?" and a user view answering "what can I
  read/write?" Both perspectives must share access rules, evidence, and stable IDs.
- Let an agent drive navigation in response to natural-language questions:
  focus entities, follow relationships, highlight access paths, inspect rules,
  and compare scenarios. Analysis and visual elements need shared stable IDs.
- Keep domain corrections made by people as persistent context for later analysis.
- Distinguish implemented behavior, intended behavior, inferred assumptions, and
  behavior demonstrated by tests. Do not infer the specification solely from the
  policies being evaluated; a bug must not become its own justification.

The discussed representation has three connected layers: database facts with
original SQL; domain meaning mapped to those facts; and intended authorization
rules with evidence and a confirmation/uncertainty status. Maintain the full
representation while supplying relevant slices to a model for a given question.
The application uses Next.js. The initial structured AI response contract, JSON
Schema, and symbolic SaaS example live in `authzcope/docs/authorization-model.md`
and its linked artifacts. The v1 draft is wired into the server-side analysis
call and Analysis page, with JSON Schema and semantic validation. It separates domain meaning, evidence, per-action
access paths, scoped scenarios, and navigation facets from renderer geometry.
Schema-only analysis must not invent live actors, resource rows, or permissions.
Introspection remains an independent evidence representation.
The analysis recollects server metadata, verifies the imported snapshot revision,
prepares scoped evidence and optional tab-memory application context, and validates
the structured AI result before exposing it. Symbolic condition checks validate the
model's internal consistency; they do not execute SQL or verify live access.
Many Supabase objects are platform machinery rather than application domain logic.
Origin hints are provisional: retain relevant identity/grant/helper dependencies
and custom policies on platform tables, without treating every included evidence
object as a business resource. Never assume platform-schema code is unmodified.
AI evidence slices focus on application implementation and relevant authorization
helpers/grants. Keep the complete catalog graph and detailed omission list in the
evidence representation, outside model prompts. Referenced platform tables must
not recursively import their attached infrastructure; explicit scope inclusion and
platform policies remain supported. The server restores omission coverage in the
validated model. Repository code is supplied context, not automatically attached.
AI generation uses a compact semantic authoring contract with short evidence
aliases; the server compiles canonical IDs, provenance, patterns, scenario outcomes
and navigation metadata. Keep the full authorization representation independent
of this provider wire format. Evidence input is bounded at 40 KB and generation
at 4,096 tokens. Report finish reason/token counts and preserve safe validation
issues through SDK error wrappers; never accept truncated output or log SQL/keys.

AI transport uses Vercel AI SDK with direct OpenAI, Anthropic, and Google
adapters. Keep provider configuration and request infrastructure separate from
domain prompt/context construction and the AI output representation.
Provider credentials resolve per request on the server; user-entered AI settings
stay in provider-scoped tab memory without persistence.

A possible later integration would turn a requested rule change into a structured
handoff for a coding agent: desired rule, affected objects, evidence, acceptance
scenarios, and schema revision. The agent could update declarative SQL, generate
a migration, test it, and return the result for a domain-level visual comparison.
This is a future direction, not an already implemented capability.

Favor a small, complete demonstration of understanding and explaining access.
Simulated red-team/blue-team competition was considered unnecessary for the core
idea. Generic shopping/travel agent demos and file-locking utilities were set
aside during exploration.

## Workspace layout

- `authzcope/`: the actual authorization analysis and visualization product.
- `saas-app/`: a separate generic SaaS example that AuthZcope will analyze. Its
  purpose is to provide realistic domain logic and interacting access rules.
- `.agents/skills/`: installed Supabase, Postgres, Next.js, React, and shadcn
  guidance. Use the applicable skills for implementation work.

Keep the product and example application distinct when choosing where work goes.
Work on the example should help demonstrate AuthZcope's explanations.

Reuse the user's existing development servers. Do not start, restart, replace,
or kill a dev server unless the user explicitly requests that action. Multiple
chats may be using the same server concurrently.

## Shared development servers

- Before starting Next.js, check existing processes, working directories, and
  listening ports for that application. Reuse an existing server across chats
  and agents. Do not start another server, including on a different port, while
  one for the application is already running.
- Diagnose a stale or unhealthy server before replacing it; do not launch a
  second server alongside it. Keep build checks from overwriting output used by
  a running production preview server.

## AuthZcope bootstrap requirements

- Accept a Postgres connection string and AI API key. Local development/demo
  credentials may come from server environment variables; prompt for missing
  values and keep user-entered credentials in application memory, without persistence.
- Keep database and AI connections separate in setup. Database configuration,
  testing, and introspection must work without AI configuration.
  Connection setup lives in a modal opened from the header, rather than a
  separate navigation screen. Analysis and Evidence setup actions open that
  same modal; credentials and settings remain in tab memory when it closes.
  Import and AI connection checks do not generate the domain model. The modal's
  Analyze & explore action explicitly starts analysis and opens Explore; the empty
  state also offers analysis/retry when setup is ready and shows progress/errors.
  Long-running analysis uses a cancellable same-origin POST stream for stage
  progress and the final validated model, with server/browser deadlines; it runs
  independently of the Server Action queue. This transport is awaiting manual
  verification.
- After connecting, collect a read-only Postgres evidence snapshot for the client
  schema inspector and future server-side model preparation. The snapshot is
  separate from the undecided AI domain output. Shared client state uses a
  provider-scoped Zustand store with typed actions and no browser persistence.
- Use server-side database introspection and AI requests. Keep injected secrets
  server-side and report only whether configuration is present to the browser.
- Start by inspecting the example SaaS database. Maintain an explicit omission
  list for infrastructure objects outside the selected application scope, while
  retaining references to external authorization dependencies as evidence.
- Plan for a hosted demo on a domain connected to a remote Supabase Postgres
  database. Use Next.js App Router, TypeScript, Tailwind CSS v4, and pnpm.
- Use React Three Fiber for the visualization. Reusable resources, actors,
  connections, relationship junctions, scenario instances, and anchored labels
  live in `authzcope/components/scene/`. Without an accepted analysis model, Explore
  shows an empty state with a Connect button opening the shared connection modal;
  scene controls and access chat require a model. The authored preview has been
  removed. Overview connections summarize full/limited/none/unknown
  access; resource geometry independently marks straightforward/conditional/unresolved
  complexity. Action ports are deferred from this flow. Manual and chat-driven
  navigation share a provider-scoped semantic command store: focus, inspect,
  highlight, perspective, overview, and comparisons of existing scoped scenarios.
  Commands use stable typed IDs and revision checks, never renderer coordinates.
  Access questions return structured explanations and navigation commands through
  the existing server AI transport; model questions recollect and validate schema
  evidence. There is no preview chat mode. Late replies
  cannot override manual navigation. The accepted-model scene compiler separates
  semantic indexing, view projection, scoped access resolution, deterministic layout,
  and primitive rendering. Selector IDs identify displayed entities; scenario copies
  have distinct scene-instance IDs and a semantic-to-instance reverse index.
  Relationship lists become access-path explanation junctions, not invented concrete
  relationships or ordered chains. Scenario panels preserve topology and placement;
  connections summarize only declared actions, and missing evaluations stay unknown.
  This compiler integration is implemented but awaiting manual testing; no checks
  were run at the user's request. Live access evaluation, bound relationship topology
  and arbitrary scenario creation remain deferred. Details live in
  `authzcope/docs/scene-components.md` and `authzcope/docs/explorer-navigation.md`.
  Role, relationship, and scenario options
  may be supplied by validated model output. Keep the authorization representation
  independent of rendering geometry and keep access evaluation separate from
  display controls. The selection inspector must be non-modal, including on
  compact screens, so users can continue interacting with the explorer.
- Use shadcn's Base UI / Nova primitives, installing missing components as needed;
  do not build a separate design system from scratch. The accepted shell direction
  pairs a warm ivory header, navigation rail, and selection inspector with a
  graphite visualization canvas and restrained coral/sage accents. Keep Geist
  fonts. Shared theme tokens live in `authzcope/app/globals.css`; editable
  primitives live in `components/ui/`. Selection and 3D navigation may remain
  placeholders until the visualizer is implemented.

## Example SaaS design

The selected example is a workspace-and-documents application using Supabase
identity and six application tables: `organizations`,
`organization_memberships`, `projects`, `project_memberships`, `documents`, and
`document_shares`.

The intended access model discussed so far is:

- Organizations are tenant boundaries. Membership has admin/member roles.
- Projects are organization-wide or restricted; project roles are editor/viewer,
  and project membership requires membership in the parent organization.
- Organization admins manage projects and memberships in their organization.
- Organization members can read published documents in organization-wide
  projects. Restricted projects require explicit membership or applicable
  document-level access. Project editors can also read and edit drafts.
- Documents have draft/published/archived states. Archived documents remain
  readable to eligible users but cannot be edited. Authorship alone grants no
  independent access.
- Individual documents can be shared with other members of the same organization
  as viewer/editor, including people outside the project. A share grants access
  only to that document, including drafts; shared editing respects archived state.
- Organization admins and project editors can manage shares. Receiving a share
  does not independently grant onward-sharing rights. Recipients must remain
  organization members. Removing a share may leave another access path intact.
- Editing content/state must not allow changing authorship or moving a document
  across projects or tenants.

Use the example to answer questions such as “Why can Maya read this draft?” and
“Does revoking this share actually remove her access?” with concrete evidence.

Declarative SQL lives under `saas-app/supabase/schemas/`, with public tables and
policies and private authorization helpers. These files express desired database
state; migrations should be generated from them using the configured workflow.
Consult `saas-app/docs/domain.md` and `saas-app/docs/access-model.md` when present
for detailed example semantics. Check current files, migrations, and test results
before claiming any design rule is implemented or verified; another chat may be
working on this example concurrently.

## Keeping context useful

Update this file for lasting changes to goals, scope, or architecture. Keep
detailed implementation documentation near the relevant application. Mark
proposals as proposals, and record completed work only with supporting evidence.
Do not turn this file into a transcript or a running command log. Inspect the
current files before editing and preserve unrelated work from other chats.
