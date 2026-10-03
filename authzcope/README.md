# Authzcope

Authorization analysis grounded in application domain meaning and database evidence.
The example Supabase application lives separately in `../saas-app`.

## Development

Use Node.js 24 and pnpm (the version is recorded in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. The Connections page accepts a Postgres connection
URL, an AI model identifier, and an AI API key. It verifies the database connection;
catalog introspection, AI requests, and visualization are still deferred.

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
- Neutral colors and Geist fonts are provisional defaults for later customization.
- Shared colors, fonts, and radii: `app/globals.css`.
- Editable components: `components/ui/` (button, card, badge, input, field,
  label, separator, navigation menu, and empty state). Prefer shared variants
  and semantic color tokens.
- Class utility: `lib/utils.ts`. Import aliases use `@/`.
- Forms should compose `FieldGroup`, `Field`, `FieldLabel`, and `Input`.
- Dark tokens are available through the `.dark` class; a theme switcher is not
  implemented yet.

## App shell and routes

All pages share `components/app-shell.tsx`, with responsive navigation, active
page indication, and a keyboard skip link. Navigation labels and destinations
live in `lib/navigation.ts`.

| Route | Workspace |
| --- | --- |
| `/` | Overview and links to each workspace |
| `/connections` | Database and AI provider configuration |
| `/schema` | Database evidence and application scope |
| `/context` | Domain meaning and intended access rules |
| `/analysis` | Access explanations with supporting evidence |

Connections has a working form; the other workspaces remain navigable scaffolds
with explicit placeholder states. Shared
`PageHeader` and `ScaffoldPage` components keep page structure consistent while
features are added. Pages remain server components; active navigation and the
connection form are client components.

Add components as needed rather than installing the entire library:

```sh
pnpm dlx shadcn@latest add dialog
```

## Deployment

The scaffold uses the standard Next.js build and start commands and can be
deployed to Vercel or a Node.js host. Database access runs on the Node.js server;
environment secrets must not use the `NEXT_PUBLIC_` prefix.

## Connection setup

The tracked `.env.development` connects Authzcope to the Supabase CLI instance
running in `../saas-app`. Next.js loads it automatically for `pnpm dev`.
Its local database URL is intentionally committed; real credentials and AI keys
belong in the gitignored `.env.local` or deployment environment variables.

Optional server environment variables (for example in a gitignored `.env.local`):

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=verify-full
AI_API_KEY=your-provider-api-key
```

Each environment credential takes precedence over its form input. Only presence
flags are sent to the browser; environment values are never rendered. Missing
credentials are entered in the form. User-entered credentials remain in page
memory and the server action's request memory without persistence, logging, or
inclusion in its response. Credentials are not restored after a page reload.

`introspectDatabase({ connectionString?, aiModel, aiApiKey? })` lives in
`app/actions/introspect-database.ts`. It validates runtime inputs, connects, runs
`SELECT 1` in a read-only transaction, and closes the connection on success or
failure. Its current result reports the connection stage, credential source, and
AI configuration presence. It does not collect catalog evidence yet. The model
identifier is free-form, and the API key is checked for presence only; neither is
verified with an AI provider.

Connection URLs accept `postgres://` or `postgresql://` with a username, host,
and database. The supported URL option is `sslmode=disable`, `require`, or
`verify-full`; both TLS modes verify the server certificate. No TLS is requested
when the option is absent. For the local example, use
`postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable`.

`pnpm test` checks validation, environment precedence, secret redaction, and
connection cleanup. To additionally test against a running database, set
`AUTHZCOPE_TEST_DATABASE_URL` to its connection URL when running the tests.

See `../AGENTS.md` for shared product decisions.
