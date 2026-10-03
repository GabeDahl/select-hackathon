-- Receives the candidate row from RLS, so INSERT ... RETURNING can authorize a
-- newly created document without re-reading the same table through a snapshot.
create function private.can_read_document(p_document_id uuid, p_project_id uuid, p_organization_id uuid, p_state text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and private.organization_role(p_organization_id) is not null
    and (private.can_manage_project(p_project_id)
      or private.document_share_permission(p_document_id) is not null
      or (p_state in ('published', 'archived') and exists (
        select 1 from public.projects p where p.id = p_project_id
          and private.can_read_project(p.id, p.organization_id, p.visibility)
      )));
$$;
revoke all on function private.can_read_document(uuid, uuid, uuid, text) from public, anon;
grant execute on function private.can_read_document(uuid, uuid, uuid, text) to authenticated, service_role;
