create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;
comment on table public.organizations is 'Tenant boundary. Membership, not document authorship, establishes organization access.';
