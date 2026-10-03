revoke all on public.organizations from public, anon, authenticated;
grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;
grant all on public.organizations to service_role;
create policy members_read_organizations on public.organizations for select to authenticated
  using (private.organization_role(id) is not null);
create policy admins_rename_organizations on public.organizations for update to authenticated
  using (private.organization_role(id) = 'admin')
  with check (private.organization_role(id) = 'admin');
