revoke all on public.document_shares from public, anon, authenticated;
grant select, delete on public.document_shares to authenticated;
grant insert (document_id, organization_id, recipient_user_id, permission) on public.document_shares to authenticated;
grant update (permission) on public.document_shares to authenticated;
grant all on public.document_shares to service_role;
create policy recipients_and_managers_read_shares on public.document_shares for select to authenticated
  using (recipient_user_id = (select auth.uid()) or private.can_share_document(document_id));
create policy project_managers_grant_shares on public.document_shares for insert to authenticated
  with check (private.can_share_document(document_id) and shared_by = (select auth.uid()));
create policy project_managers_change_shares on public.document_shares for update to authenticated
  using (private.can_share_document(document_id))
  with check (private.can_share_document(document_id));
create policy project_managers_revoke_shares on public.document_shares for delete to authenticated
  using (private.can_share_document(document_id));
