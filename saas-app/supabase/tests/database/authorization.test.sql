begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
-- Fixtures are inserted within this transaction and rolled back.
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

-- Nora: Boreal admin, outside Acme
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select results_eq($test$select count(*) from public.documents where organization_id = '20000000-0000-0000-0000-000000000001'$test$, array[0::bigint], 'Tenant isolation: Boreal admin cannot read Acme documents');
select results_eq($test$select count(*) from public.organizations where id = '20000000-0000-0000-0000-000000000001'$test$, array[0::bigint], 'An outsider cannot read another organization');
select results_eq($test$select count(*) from public.organization_memberships where organization_id = '20000000-0000-0000-0000-000000000001'$test$, array[0::bigint], 'An outsider cannot read another organization roster');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000007'$test$, array[1::bigint], 'Admin can read a draft in their own organization');
select results_eq($test$with changed as (update public.documents set body = 'not authorized' where id = '40000000-0000-0000-0000-000000000001' returning 1) select count(*) from changed$test$, array[0::bigint], 'Outsider cannot update cross-tenant content');
select throws_ok($test$insert into public.projects(organization_id, name) values ('20000000-0000-0000-0000-000000000001', 'Intrusion')$test$, '42501', null, 'Outsider cannot create another tenant project');

-- Quinn: organization member and direct viewer, without project membership
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000001'$test$, array[1::bigint], 'Organization membership permits published handbook access');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000002'$test$, array[0::bigint], 'Organization membership alone does not reveal drafts');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000003'$test$, array[1::bigint], 'Organization member can read archived handbook');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000004'$test$, array[1::bigint], 'Direct viewer share permits reading a restricted draft');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000005'$test$, array[0::bigint], 'A direct share does not expose neighboring documents');
select results_eq($test$select count(*) from public.projects where id = '30000000-0000-0000-0000-000000000002'$test$, array[0::bigint], 'A direct share does not grant project visibility');
select results_eq($test$select count(*) from public.project_memberships where project_id = '30000000-0000-0000-0000-000000000002'$test$, array[0::bigint], 'A direct share does not expose the project roster');
select results_eq($test$select count(*) from public.document_shares where document_id = '40000000-0000-0000-0000-000000000004'$test$, array[1::bigint], 'Recipient sees their own share, not other recipients');
select results_eq($test$with changed as (update public.documents set body = 'viewer edit' where id = '40000000-0000-0000-0000-000000000004' returning 1) select count(*) from changed$test$, array[0::bigint], 'Viewer share does not permit editing');
select results_eq($test$with changed as (update public.organization_memberships set role = 'admin' where organization_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000004' returning 1) select count(*) from changed$test$, array[0::bigint], 'Member cannot promote themselves to organization admin');
select throws_ok($test$insert into public.organization_memberships(organization_id, user_id, role) values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'admin')$test$, '42501', null, 'Member cannot enroll themselves as another tenant admin');
select throws_ok($test$insert into public.documents(project_id, organization_id, title) values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Unauthorized draft')$test$, '42501', null, 'Member cannot create documents without editor authority');
select throws_ok($test$insert into public.document_shares(document_id, organization_id, recipient_user_id, permission) values ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'viewer')$test$, '42501', null, 'Viewer recipient cannot reshare');

-- Maya: project viewer, author attribution, direct editor
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000002'$test$, array[0::bigint], 'Authorship does not grant permission to read a draft');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000004'$test$, array[1::bigint], 'Direct editor share adds draft access to a project viewer');
select results_eq($test$with changed as (update public.documents set body = 'Maya contributed' where id = '40000000-0000-0000-0000-000000000004' returning 1) select count(*) from changed$test$, array[1::bigint], 'Direct editor share permits content editing');
select results_eq($test$with changed as (update public.documents set body = 'Archived edit' where id = '40000000-0000-0000-0000-000000000006' returning 1) select count(*) from changed$test$, array[0::bigint], 'Editor share cannot override archived read-only state');
select results_eq($test$with changed as (update public.documents set state = 'draft' where id = '40000000-0000-0000-0000-000000000006' returning 1) select count(*) from changed$test$, array[0::bigint], 'Editor share cannot unarchive a document');
select throws_ok($test$update public.documents set project_id = '30000000-0000-0000-0000-000000000001' where id = '40000000-0000-0000-0000-000000000004'$test$, '42501', null, 'Shared editor cannot move a document to another project');
select throws_ok($test$update public.documents set organization_id = '20000000-0000-0000-0000-000000000002' where id = '40000000-0000-0000-0000-000000000004'$test$, '42501', null, 'Shared editor cannot rewrite the tenant');
select throws_ok($test$update public.documents set author_id = '10000000-0000-0000-0000-000000000003' where id = '40000000-0000-0000-0000-000000000004'$test$, '42501', null, 'Shared editor cannot rewrite authorship');
select throws_ok($test$insert into public.document_shares(document_id, organization_id, recipient_user_id, permission) values ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'editor')$test$, '42501', null, 'Editor recipient cannot reshare');
select results_eq($test$with changed as (update public.document_shares set permission = 'editor' where document_id = '40000000-0000-0000-0000-000000000005' and recipient_user_id = '10000000-0000-0000-0000-000000000003' returning 1) select count(*) from changed$test$, array[0::bigint], 'Recipient cannot upgrade their viewer share');
select results_eq($test$with changed as (delete from public.document_shares where document_id = '40000000-0000-0000-0000-000000000004' and recipient_user_id = '10000000-0000-0000-0000-000000000003' returning 1) select count(*) from changed$test$, array[0::bigint], 'Recipient cannot revoke shares without share-management authority');
select results_eq($test$with changed as (update public.projects set visibility = 'organization' where id = '30000000-0000-0000-0000-000000000002' returning 1) select count(*) from changed$test$, array[0::bigint], 'Project viewer cannot make a restricted project organization-wide');
select results_eq($test$with changed as (update public.project_memberships set role = 'editor' where project_id = '30000000-0000-0000-0000-000000000002' and user_id = '10000000-0000-0000-0000-000000000003' returning 1) select count(*) from changed$test$, array[0::bigint], 'Project viewer cannot promote themselves');
select throws_ok($test$delete from public.documents where id = '40000000-0000-0000-0000-000000000004'$test$, '42501', null, 'Document deletion is outside the client API');

-- Alice: Acme admin, Boreal project viewer
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select results_eq($test$select count(*) from public.documents where organization_id = '20000000-0000-0000-0000-000000000001'$test$, array[6::bigint], 'Organization admin can read all six own-tenant documents');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000007'$test$, array[0::bigint], 'Admin role does not carry into another organization');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000008'$test$, array[1::bigint], 'The same person can be a viewer in a different organization');
select results_eq($test$with changed as (update public.documents set body = 'No cross-tenant administration' where id = '40000000-0000-0000-0000-000000000008' returning 1) select count(*) from changed$test$, array[0::bigint], 'Own-tenant admin cannot edit another tenant viewer resource');
select results_eq($test$with changed as (update public.documents set body = 'Admin archived edit' where id = '40000000-0000-0000-0000-000000000003' returning 1) select count(*) from changed$test$, array[0::bigint], 'Even organization admins cannot edit archived content');
select results_eq($test$with changed as (update public.organization_memberships set role = 'member' where organization_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000001' returning 1) select count(*) from changed$test$, array[0::bigint], 'Admin cannot demote themselves');
select results_eq($test$with changed as (delete from public.organization_memberships where organization_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000001' returning 1) select count(*) from changed$test$, array[0::bigint], 'Admin cannot remove themselves');
select results_eq($test$with created as (insert into public.projects(organization_id, name) values ('20000000-0000-0000-0000-000000000001', 'New project') returning id) select count(*) from created$test$, array[1::bigint], 'Admin can create a project with INSERT RETURNING');
select throws_ok($test$insert into public.project_memberships(project_id, organization_id, user_id, role) values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'viewer')$test$, '23503', null, 'Project membership requires membership in the project tenant');
select throws_ok($test$insert into public.project_memberships(project_id, organization_id, user_id, role) values ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'viewer')$test$, '23503', null, 'Project membership cannot forge the project tenant');

-- Ben: project editor and share manager
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000002'$test$, array[1::bigint], 'Project editor can read drafts without authorship');
select results_eq($test$select count(*) from public.document_shares where document_id = '40000000-0000-0000-0000-000000000004'$test$, array[2::bigint], 'Project editor can inspect all shares on their document');
select results_eq($test$with created as (insert into public.documents(project_id, organization_id, title) values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Editor-created draft') returning id) select count(*) from created$test$, array[1::bigint], 'Project editor can create a draft with INSERT RETURNING');
select throws_ok($test$insert into public.documents(project_id, organization_id, title) values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Wrong tenant')$test$, '23503', null, 'Document tenant must match its project');
select throws_ok($test$insert into public.documents(project_id, organization_id, title, state) values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Skip draft', 'published')$test$, '42501', null, 'Clients cannot skip draft creation by supplying state');
select results_eq($test$with changed as (update public.documents set state = 'published' where id = '40000000-0000-0000-0000-000000000002' returning 1) select count(*) from changed$test$, array[1::bigint], 'Editor can publish a draft');
select results_eq($test$with changed as (update public.documents set state = 'archived' where id = '40000000-0000-0000-0000-000000000002' returning 1) select count(*) from changed$test$, array[1::bigint], 'Editor can archive a document');
select results_eq($test$with changed as (update public.documents set state = 'draft' where id = '40000000-0000-0000-0000-000000000002' returning 1) select count(*) from changed$test$, array[0::bigint], 'Archiving is terminal even for project editors');
select results_eq($test$with created as (insert into public.document_shares(document_id, organization_id, recipient_user_id, permission) values ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'viewer') returning document_id) select count(*) from created$test$, array[1::bigint], 'Project editor can grant a share with INSERT RETURNING');
select results_eq($test$with changed as (update public.document_shares set permission = 'editor' where document_id = '40000000-0000-0000-0000-000000000005' and recipient_user_id = '10000000-0000-0000-0000-000000000004' returning 1) select count(*) from changed$test$, array[1::bigint], 'Project editor can change share permission');
select throws_ok($test$insert into public.document_shares(document_id, organization_id, recipient_user_id, permission) values ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'viewer')$test$, '23503', null, 'Cross-tenant sharing is rejected by membership integrity');
select throws_ok($test$insert into public.document_shares(document_id, organization_id, recipient_user_id, permission) values ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'viewer')$test$, '23503', null, 'Forging the share tenant cannot bypass isolation');
select throws_ok($test$insert into public.document_shares(document_id, organization_id, recipient_user_id, permission, shared_by) values ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'viewer', '10000000-0000-0000-0000-000000000001')$test$, '42501', null, 'Share grantors cannot be forged');
select results_eq($test$with changed as (delete from public.document_shares where document_id = '40000000-0000-0000-0000-000000000004' and recipient_user_id = '10000000-0000-0000-0000-000000000003' returning 1) select count(*) from changed$test$, array[1::bigint], 'Project editor can revoke a direct editor share');
select results_eq($test$with changed as (delete from public.document_shares where document_id = '40000000-0000-0000-0000-000000000005' and recipient_user_id = '10000000-0000-0000-0000-000000000003' returning 1) select count(*) from changed$test$, array[1::bigint], 'Project editor can revoke an overlapping viewer share');
select results_eq($test$with changed as (delete from public.document_shares where document_id = '40000000-0000-0000-0000-000000000004' and recipient_user_id = '10000000-0000-0000-0000-000000000004' returning 1) select count(*) from changed$test$, array[1::bigint], 'Project editor can revoke a share-only access path');
select results_eq($test$with changed as (update public.project_memberships set role = 'editor' where project_id = '30000000-0000-0000-0000-000000000002' and user_id = '10000000-0000-0000-0000-000000000003' returning 1) select count(*) from changed$test$, array[0::bigint], 'Project editor cannot manage project membership');

-- Maya after share revocation
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000004'$test$, array[0::bigint], 'Revoking editor share removes draft access from project viewer');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000005'$test$, array[1::bigint], 'Revoking a share preserves independent project-viewer access');
select results_eq($test$with changed as (update public.documents set body = 'Lost editor permission' where id = '40000000-0000-0000-0000-000000000004' returning 1) select count(*) from changed$test$, array[0::bigint], 'Revoked editor share no longer allows editing');

-- Quinn after direct share revocation
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000004'$test$, array[0::bigint], 'Revoking the sole access path removes document access');
select results_eq($test$select count(*) from public.documents where id = '40000000-0000-0000-0000-000000000005'$test$, array[1::bigint], 'Separate editor share grants access independently');
select results_eq($test$with changed as (update public.documents set body = 'Quinn contributed' where id = '40000000-0000-0000-0000-000000000005' returning 1) select count(*) from changed$test$, array[1::bigint], 'Upgraded editor share permits editing without project membership');
select lives_ok($test$select public.create_organization('Quinn workspace')$test$, 'Authenticated user can bootstrap an organization');
select results_eq($test$select count(*) from public.organization_memberships where organization_id in (select id from public.organizations where name = 'Quinn workspace') and role = 'admin'$test$, array[1::bigint], 'Bootstrap atomically establishes caller as organization admin');
select throws_ok($test$select public.create_organization('   ')$test$, '23514', null, 'Bootstrap rejects blank organization names');
select results_eq($test$select count(*) from public.organizations where name = ''$test$, array[0::bigint], 'Failed bootstrap leaves no organization row');

-- Alice removes Maya from Acme
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select results_eq($test$with changed as (delete from public.organization_memberships where organization_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000003' returning 1) select count(*) from changed$test$, array[1::bigint], 'Organization admin can remove another member');
select results_eq($test$select count(*) from public.project_memberships where organization_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000003'$test$, array[0::bigint], 'Membership removal cascades to project memberships');
select results_eq($test$select count(*) from public.document_shares where organization_id = '20000000-0000-0000-0000-000000000001' and recipient_user_id = '10000000-0000-0000-0000-000000000003'$test$, array[0::bigint], 'Membership removal cascades to remaining direct shares');

-- Maya after tenant membership removal
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select results_eq($test$select count(*) from public.documents where organization_id = '20000000-0000-0000-0000-000000000001'$test$, array[0::bigint], 'Removed member has no residual tenant access');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select results_eq($test$select count(*) from public.documents where true$test$, array[0::bigint], 'Authenticated database role without user identity reveals no documents');
select throws_ok($test$select public.create_organization('No identity')$test$, '42501', null, 'Bootstrap rejects a missing caller identity');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select throws_ok($test$select * from public.documents$test$, '42501', null, 'Anonymous role cannot access application tables');
select throws_ok($test$select public.create_organization('Anonymous workspace')$test$, '42501', null, 'Anonymous role cannot execute organization bootstrap');
select throws_ok($test$select private.organization_role('20000000-0000-0000-0000-000000000001')$test$, '42501', null, 'Anonymous role cannot invoke private lookup helpers');

reset role;
select * from finish();
rollback;
