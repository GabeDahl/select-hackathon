create table public.project_memberships (
  project_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id) on delete cascade,
  foreign key (organization_id, user_id) references public.organization_memberships(organization_id, user_id) on delete cascade
);
create index project_memberships_organization_user_idx on public.project_memberships(organization_id, user_id);
create index project_memberships_user_id_idx on public.project_memberships(user_id);
alter table public.project_memberships enable row level security;
comment on table public.project_memberships is 'Resource-scoped editor/viewer role. The member must belong to the same organization as the project.';
