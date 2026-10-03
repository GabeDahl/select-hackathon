create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_memberships_user_id_idx on public.organization_memberships(user_id);
alter table public.organization_memberships enable row level security;
comment on table public.organization_memberships is 'Live tenant membership and organization role. Removing membership removes dependent project memberships and document shares.';
