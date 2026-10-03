revoke all on public.projects from public, anon, authenticated;
grant select on public.projects to authenticated;
grant insert (organization_id, name, visibility) on public.projects to authenticated;
grant update (name, visibility) on public.projects to authenticated;
grant all on public.projects to service_role;
create policy eligible_users_read_projects on public.projects for select to authenticated
  using (private.can_read_project(id, organization_id, visibility));
create policy admins_create_projects on public.projects for insert to authenticated
  with check (private.organization_role(organization_id) = 'admin');
create policy admins_update_projects on public.projects for update to authenticated
  using (private.organization_role(organization_id) = 'admin')
  with check (private.organization_role(organization_id) = 'admin');
