create function private.can_edit_document(p_document_id uuid, p_project_id uuid, p_organization_id uuid, p_state text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select auth.uid() is not null and p_state <> 'archived'
    and private.organization_role(p_organization_id) is not null
    and (private.can_manage_project(p_project_id)
      or coalesce(private.document_share_permission(p_document_id) = 'editor', false));
$$;
revoke all on function private.can_edit_document(uuid, uuid, uuid, text) from public, anon;
grant execute on function private.can_edit_document(uuid, uuid, uuid, text) to authenticated, service_role;
