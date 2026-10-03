-- Editors can author documents and manage shares; only organization admins
-- can change the project itself or its membership (enforced by table policies).
create function private.can_manage_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.projects p where p.id = p_project_id
      and private.organization_role(p.organization_id) is not null
      and (private.organization_role(p.organization_id) = 'admin'
        or private.project_role(p.id) = 'editor')
  );
$$;
revoke all on function private.can_manage_project(uuid) from public, anon;
grant execute on function private.can_manage_project(uuid) to authenticated, service_role;
