revoke all on public.documents from public, anon, authenticated;
grant select on public.documents to authenticated;
grant insert (project_id, organization_id, title, body) on public.documents to authenticated;
-- Tenant, project, author, identifier, and timestamp cannot be rewritten by clients.
grant update (title, body, state) on public.documents to authenticated;
grant all on public.documents to service_role;
create policy eligible_users_read_documents on public.documents for select to authenticated
  using (private.can_read_document(id, project_id, organization_id, state));
create policy project_editors_create_drafts on public.documents for insert to authenticated
  with check (private.can_manage_project(project_id) and author_id = (select auth.uid()) and state = 'draft');
create policy eligible_editors_update_documents on public.documents for update to authenticated
  using (private.can_edit_document(id, project_id, organization_id, state))
  -- The old row must be editable; the new row may become archived. Immutable
  -- relationship columns are enforced by column grants, not this predicate.
  with check (private.can_read_document(id, project_id, organization_id, state));
