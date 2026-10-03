-- LOCAL DEMO DATA ONLY. Idempotent inserts; existing rows are not overwritten.
-- Every demo account uses password: AuthzcopeDemo2026!
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000'::uuid, id::uuid, 'authenticated', 'authenticated',
  email, extensions.crypt('AuthzcopeDemo2026!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', display_name), now(), now(), '', '', '', ''
from (values
  ('10000000-0000-0000-0000-000000000001', 'alice@example.test', 'Alice'),
  ('10000000-0000-0000-0000-000000000002', 'ben@example.test', 'Ben'),
  ('10000000-0000-0000-0000-000000000003', 'maya@example.test', 'Maya'),
  ('10000000-0000-0000-0000-000000000004', 'quinn@example.test', 'Quinn'),
  ('10000000-0000-0000-0000-000000000005', 'nora@example.test', 'Nora')
) as users(id, email, display_name)
on conflict (id) do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email', now(), now(), now()
from auth.users u where u.id in (
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005'
) on conflict (provider_id, provider) do nothing;

insert into public.organizations(id, name) values
  ('20000000-0000-0000-0000-000000000001', 'Acme Research'),
  ('20000000-0000-0000-0000-000000000002', 'Boreal Studio')
on conflict (id) do nothing;

insert into public.organization_memberships(organization_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'member'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'member'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'member'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'admin'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'member')
on conflict (organization_id, user_id) do nothing;

insert into public.projects(id, organization_id, name, visibility) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Handbook', 'organization'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Launch Planning', 'restricted'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'Client Strategy', 'restricted')
on conflict (id) do nothing;

insert into public.project_memberships(project_id, organization_id, user_id, role) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'editor'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'editor'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'viewer'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'viewer')
on conflict (project_id, user_id) do nothing;

insert into public.documents(id, project_id, organization_id, author_id, title, body, state) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Welcome handbook', 'Published guidance for all Acme members.', 'published'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Handbook revision', 'Maya is the author but authorship does not grant access.', 'draft'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Previous handbook', 'Archived and read-only, including for administrators.', 'archived'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Launch draft', 'Shared with Maya as editor and Quinn as viewer.', 'draft'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Launch announcement', 'Maya has both project-viewer and direct-share access.', 'published'),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Previous launch', 'An editor share cannot override archived state.', 'archived'),
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'Client draft', 'Alice administers Acme but is only a viewer at Boreal.', 'draft'),
  ('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'Client brief', 'Alice can read, but cannot edit, this published document.', 'published')
on conflict (id) do nothing;

insert into public.document_shares(document_id, organization_id, recipient_user_id, permission, shared_by) values
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'editor', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'viewer', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'viewer', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'editor', '10000000-0000-0000-0000-000000000002')
on conflict (document_id, recipient_user_id) do nothing;
