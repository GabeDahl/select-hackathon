# SaaS authorization example

Six application tables, relationship-scoped roles, document lifecycle rules,
and direct document sharing. Supabase Auth owns user identity.

Read [domain meaning](docs/domain.md) and the [intended access model](docs/access-model.md).

## Declarative workflow

The source of truth is `supabase/schemas/`. Edit tables, functions, policies,
and grants there. `config.toml` enables pg-delta, which orders SQL dependencies.

```sh
supabase db schema declarative sync -f describe_your_change --no-apply
# Review the generated SQL under supabase/migrations/.
supabase migration up --local
supabase test db --local
supabase db advisors --local --type security --level warn --fail-on warn
```

To initialize the demo data on a running local stack without resetting it:

```sh
supabase db query --local --file supabase/seed.sql
```

The seed uses idempotent inserts and never overwrites existing fixture rows.
Do not load the demo seed into production. Demo credentials are in `docs/domain.md`.

The authorization test uses its own transaction and loads these fixtures within
that transaction; all test changes roll back. It can run on an unseeded database.

## Layout

- `supabase/schemas/public/tables/`: tables, constraints, indexes, RLS enablement, comments.
- `supabase/schemas/public/policies/`: operation-specific policies and explicit grants.
- `supabase/schemas/private/functions/`: caller-scoped authorization and bootstrap helpers.
- `supabase/schemas/public/functions/`: exposed invoker wrapper for organization creation.
- `supabase/migrations/`: generated migration history.
- `supabase/tests/database/`: executable allow/deny scenarios.
- `supabase/seed.sql`: two organizations, five users, three projects, eight documents, four shares.
