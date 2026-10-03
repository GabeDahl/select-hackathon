# Authzcope project context

This file is shared context for chats and coding agents working in this workspace.
Keep it concise and update it when the user changes the product direction or makes
a lasting architectural decision. Record decisions here rather than relying on
another chat's history. The user's current instructions take precedence.

## Goal

Build **Authzcope** for a Supabase hackathon whose theme is **“build something
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

## Product direction

- Infer actors, resources, relationships, workflow states, and intended rules from
  evidence. Roles may depend on a user's relationship to a particular resource.
- Explain effective access through policies, helper functions, grants, and
  relevant views or other access paths; connect the result to business meaning.
- Make the explanation inspectable through a visualization usable by both
  technical and non-technical people. SQL details should be available as evidence.
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
Its exact format remains an open decision. The application uses Next.js.

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
- `saas-app/`: a separate generic SaaS example that Authzcope will analyze. Its
  purpose is to provide realistic domain logic and interacting access rules.
- `.agents/skills/`: installed Supabase, Postgres, Next.js, React, and shadcn
  guidance. Use the applicable skills for implementation work.

Keep the product and example application distinct when choosing where work goes.
Work on the example should help demonstrate Authzcope's explanations.

## Authzcope bootstrap requirements

- Accept a Postgres connection string and AI API key. Local development/demo
  credentials may come from server environment variables; prompt for missing
  values and keep user-entered credentials in application memory, without persistence.
- Use server-side database introspection and AI requests. Keep injected secrets
  server-side and report only whether configuration is present to the browser.
- Start by inspecting the example SaaS database. Maintain an explicit omission
  list for infrastructure objects outside the selected application scope, while
  retaining references to external authorization dependencies as evidence.
- Plan for a hosted demo on a domain connected to a remote Supabase Postgres
  database. Use Next.js App Router, TypeScript, Tailwind CSS v4, and pnpm.
- Defer visualization implementation and dependencies. React Flow is not the
  selected approach; visualization technology remains open. Initial work should
  focus on credential setup, introspection, application scope filtering, and AI
  analysis, using a representation independent of any rendering library.
- Establish Authzcope's own design/style system from scratch, using selected
  shadcn/ui components as editable starting points and customizing them centrally
  for consistent application UI. Colors, typography, and visual direction remain
  undecided; the previously proposed light/blue treatment is not an accepted choice.
- The scaffold uses shadcn's Base UI / Nova components with neutral tokens and
  Geist fonts as provisional defaults. Shared tokens live in
  `authzcope/app/globals.css`; editable primitives live in `components/ui/`.

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
