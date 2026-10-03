create function private.can_share_document(p_document_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.documents d where d.id = p_document_id
      and private.can_manage_project(d.project_id)
  );
$$;
revoke all on function private.can_share_document(uuid) from public, anon;
grant execute on function private.can_share_document(uuid) to authenticated, service_role;
