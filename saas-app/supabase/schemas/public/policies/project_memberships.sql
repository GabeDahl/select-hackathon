revoke all on public.project_memberships from public, anon, authenticated;
grant select, insert, delete on public.project_memberships to authenticated;
grant update (role) on public.project_memberships to authenticated;
grant all on public.project_memberships to service_role;
create policy project_users_read_project_roster on public.project_memberships for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));
create policy admins_add_project_members on public.project_memberships for insert to authenticated
  with check (private.organization_role(organization_id) = 'admin');
create policy admins_change_project_roles on public.project_memberships for update to authenticated
  using (private.organization_role(organization_id) = 'admin')
  with check (private.organization_role(organization_id) = 'admin');
create policy admins_remove_project_members on public.project_memberships for delete to authenticated
  using (private.organization_role(organization_id) = 'admin');
