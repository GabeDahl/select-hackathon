-- SECURITY DEFINER deliberately reads protected membership rows without recursive RLS.
-- Always scoped to the caller; it cannot inspect another user's role.
create function private.organization_role(p_organization_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select m.role from public.organization_memberships m
  where m.organization_id = p_organization_id and m.user_id = (select auth.uid());
$$;
revoke all on function private.organization_role(uuid) from public, anon;
grant execute on function private.organization_role(uuid) to authenticated, service_role;
