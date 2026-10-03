create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  visibility text not null default 'restricted' check (visibility in ('organization', 'restricted')),
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index projects_organization_id_idx on public.projects(organization_id);
alter table public.projects enable row level security;
comment on column public.projects.visibility is 'Organization projects expose published and archived documents to organization members. Restricted projects require a project role or a document-specific share.';
