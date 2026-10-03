create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  organization_id uuid not null,
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  body text not null default '',
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id) on delete cascade
);
create index documents_project_organization_idx on public.documents(project_id, organization_id);
create index documents_organization_id_idx on public.documents(organization_id);
create index documents_author_id_idx on public.documents(author_id);
alter table public.documents enable row level security;
comment on column public.documents.author_id is 'Attribution only; authorship never grants access. Set to null if the Auth user is deleted.';
comment on column public.documents.state is 'Drafts require editor/admin access or a direct share. Published and archived documents also permit project viewers. Archived documents cannot be edited, including by admins.';
