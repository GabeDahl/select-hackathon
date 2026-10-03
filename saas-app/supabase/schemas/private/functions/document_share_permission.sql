create function private.document_share_permission(p_document_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select s.permission from public.document_shares s
  where s.document_id = p_document_id and s.recipient_user_id = (select auth.uid())
    and private.organization_role(s.organization_id) is not null;
$$;
revoke all on function private.document_share_permission(uuid) from public, anon;
grant execute on function private.document_share_permission(uuid) to authenticated, service_role;
