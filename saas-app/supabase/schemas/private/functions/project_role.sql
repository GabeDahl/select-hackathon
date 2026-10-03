create function private.project_role(p_project_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select m.role from public.project_memberships m
  where m.project_id = p_project_id and m.user_id = (select auth.uid())
    and private.organization_role(m.organization_id) is not null;
$$;
revoke all on function private.project_role(uuid) from public, anon;
grant execute on function private.project_role(uuid) to authenticated, service_role;
