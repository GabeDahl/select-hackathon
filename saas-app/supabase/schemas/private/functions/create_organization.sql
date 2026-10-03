-- Controlled bootstrap: one organization and its first admin in one transaction.
create function private.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.organizations(name) values (btrim(p_name)) returning id into v_organization_id;
  insert into public.organization_memberships(organization_id, user_id, role)
    values (v_organization_id, v_user_id, 'admin');
  return v_organization_id;
end;
$$;
revoke all on function private.create_organization(text) from public, anon;
grant execute on function private.create_organization(text) to authenticated, service_role;
