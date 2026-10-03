revoke all on public.organization_memberships from public, anon, authenticated;
grant select, insert, delete on public.organization_memberships to authenticated;
grant update (role) on public.organization_memberships to authenticated;
grant all on public.organization_memberships to service_role;
create policy members_read_organization_roster on public.organization_memberships for select to authenticated
  using (private.organization_role(organization_id) is not null);
create policy admins_add_organization_members on public.organization_memberships for insert to authenticated
  with check (private.organization_role(organization_id) = 'admin' and user_id <> (select auth.uid()));
-- Admins cannot demote/remove themselves; another admin must manage their role.
create policy admins_change_other_organization_roles on public.organization_memberships for update to authenticated
  using (private.organization_role(organization_id) = 'admin' and user_id <> (select auth.uid()))
  with check (private.organization_role(organization_id) = 'admin' and user_id <> (select auth.uid()));
create policy admins_remove_other_organization_members on public.organization_memberships for delete to authenticated
  using (private.organization_role(organization_id) = 'admin' and user_id <> (select auth.uid()));
