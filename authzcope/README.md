# Authzcope

Authorization analysis grounded in application domain meaning and database evidence.
The example Supabase application lives separately in `../saas-app`.

## Development

Use Node.js 24 and pnpm (the version is recorded in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. No database or AI credentials are required for the
current scaffold. Connection setup, introspection, and analysis are still to be
implemented. Visualization is deferred.

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

## UI foundation

- Next.js App Router, React, TypeScript, and Tailwind CSS v4.
- Shadcn components using Base UI primitives and the Nova source template.
- Neutral colors and Geist fonts are provisional defaults for later customization.
- Shared colors, fonts, and radii: `app/globals.css`.
- Editable components: `components/ui/` (button, card, badge, input, field,
  label, and separator). Prefer shared variants and semantic color tokens.
- Class utility: `lib/utils.ts`. Import aliases use `@/`.
- Forms should compose `FieldGroup`, `Field`, `FieldLabel`, and `Input`.
- Dark tokens are available through the `.dark` class; a theme switcher is not
  implemented yet.

Add components as needed rather than installing the entire library:

```sh
pnpm dlx shadcn@latest add dialog
```

## Deployment

The scaffold uses the standard Next.js build and start commands and can be
deployed to Vercel or a Node.js host. Future database and AI integrations will
run on the server; environment secrets must not use the `NEXT_PUBLIC_` prefix.
User-entered credentials will stay in application memory without persistence.

See `../AGENTS.md` for shared product decisions.
