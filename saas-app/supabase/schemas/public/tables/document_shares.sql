create table public.document_shares (
  document_id uuid not null,
  organization_id uuid not null,
  recipient_user_id uuid not null,
  permission text not null check (permission in ('viewer', 'editor')),
  shared_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (document_id, recipient_user_id),
  foreign key (document_id, organization_id) references public.documents(id, organization_id) on delete cascade,
  foreign key (organization_id, recipient_user_id) references public.organization_memberships(organization_id, user_id) on delete cascade
);
create index document_shares_organization_recipient_idx on public.document_shares(organization_id, recipient_user_id);
create index document_shares_recipient_user_id_idx on public.document_shares(recipient_user_id);
create index document_shares_shared_by_idx on public.document_shares(shared_by);
alter table public.document_shares enable row level security;
comment on table public.document_shares is 'Direct document access within a tenant, including drafts. Does not confer project access or permission to reshare. Independent access paths can survive share revocation.';
