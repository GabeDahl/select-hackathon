create function private.can_read_project(p_project_id uuid, p_organization_id uuid, p_visibility text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select auth.uid() is not null
    and private.organization_role(p_organization_id) is not null
    and (private.organization_role(p_organization_id) = 'admin'
      or p_visibility = 'organization' or private.project_role(p_project_id) is not null);
$$;
revoke all on function private.can_read_project(uuid, uuid, text) from public, anon;
grant execute on function private.can_read_project(uuid, uuid, text) to authenticated, service_role;
