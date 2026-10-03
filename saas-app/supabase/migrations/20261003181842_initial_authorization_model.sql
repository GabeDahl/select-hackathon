SET local check_function_bodies = off;

CREATE SCHEMA "private";

CREATE TABLE "public"."document_shares" (
  "document_id"       uuid                     NOT NULL,
  "organization_id"   uuid                     NOT NULL,
  "recipient_user_id" uuid                     NOT NULL,
  "permission"        text                     NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "document_shares_permission_check" CHECK ((permission = ANY (ARRAY['viewer'::text, 'editor'::text]))),
  CONSTRAINT "document_shares_pkey" PRIMARY KEY (document_id, recipient_user_id),
  "shared_by"         uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."document_shares"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."document_shares" FROM "anon";

CREATE TABLE "public"."documents" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id"      uuid                     NOT NULL,
  "organization_id" uuid                     NOT NULL,
  "title"           text                     NOT NULL,
  "body"            text                     NOT NULL DEFAULT ''::text,
  "state"           text                     NOT NULL DEFAULT 'draft'::text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "documents_id_organization_id_key" UNIQUE (id, organization_id),
  CONSTRAINT "documents_pkey" PRIMARY KEY (id),
  CONSTRAINT "documents_state_check" CHECK ((state = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
  CONSTRAINT "documents_title_check" CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200))),
  "author_id"       uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."documents"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."documents" FROM "anon";

CREATE TABLE "public"."organization_memberships" (
  "organization_id" uuid                     NOT NULL,
  "user_id"         uuid                     NOT NULL,
  "role"            text                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "organization_memberships_pkey" PRIMARY KEY (organization_id, user_id),
  CONSTRAINT "organization_memberships_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);

ALTER TABLE "public"."organization_memberships"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."organization_memberships" FROM "anon";

CREATE TABLE "public"."organizations" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "organizations_name_check" CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 120))),
  CONSTRAINT "organizations_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."organizations"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."organizations" FROM "anon";

CREATE TABLE "public"."project_memberships" (
  "project_id"      uuid                     NOT NULL,
  "organization_id" uuid                     NOT NULL,
  "user_id"         uuid                     NOT NULL,
  "role"            text                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "project_memberships_pkey" PRIMARY KEY (project_id, user_id),
  CONSTRAINT "project_memberships_role_check" CHECK ((role = ANY (ARRAY['editor'::text, 'viewer'::text])))
);

ALTER TABLE "public"."project_memberships"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."project_memberships" FROM "anon";

CREATE TABLE "public"."projects" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid                     NOT NULL,
  "name"            text                     NOT NULL,
  "visibility"      text                     NOT NULL DEFAULT 'restricted'::text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "projects_id_organization_id_key" UNIQUE (id, organization_id),
  CONSTRAINT "projects_name_check" CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 120))),
  CONSTRAINT "projects_pkey" PRIMARY KEY (id),
  CONSTRAINT "projects_visibility_check" CHECK ((visibility = ANY (ARRAY['organization'::text, 'restricted'::text])))
);

ALTER TABLE "public"."projects"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."projects" FROM "anon";

CREATE OR REPLACE FUNCTION private.can_edit_document (
  p_document_id     uuid,
  p_project_id      uuid,
  p_organization_id uuid,
  p_state           text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select auth.uid() is not null and p_state <> 'archived'
    and private.organization_role(p_organization_id) is not null
    and (private.can_manage_project(p_project_id)
      or coalesce(private.document_share_permission(p_document_id) = 'editor', false));
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_project (
  p_project_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select auth.uid() is not null and exists (
    select 1 from public.projects p where p.id = p_project_id
      and private.organization_role(p.organization_id) is not null
      and (private.organization_role(p.organization_id) = 'admin'
        or private.project_role(p.id) = 'editor')
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_read_document (
  p_document_id     uuid,
  p_project_id      uuid,
  p_organization_id uuid,
  p_state           text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select auth.uid() is not null and private.organization_role(p_organization_id) is not null
    and (private.can_manage_project(p_project_id)
      or private.document_share_permission(p_document_id) is not null
      or (p_state in ('published', 'archived') and exists (
        select 1 from public.projects p where p.id = p_project_id
          and private.can_read_project(p.id, p.organization_id, p.visibility)
      )));
$function$;

CREATE OR REPLACE FUNCTION private.can_read_project (
  p_project_id      uuid,
  p_organization_id uuid,
  p_visibility      text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select auth.uid() is not null
    and private.organization_role(p_organization_id) is not null
    and (private.organization_role(p_organization_id) = 'admin'
      or p_visibility = 'organization' or private.project_role(p_project_id) is not null);
$function$;

CREATE OR REPLACE FUNCTION private.can_share_document (
  p_document_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select auth.uid() is not null and exists (
    select 1 from public.documents d where d.id = p_document_id
      and private.can_manage_project(d.project_id)
  );
$function$;

CREATE OR REPLACE FUNCTION private.create_organization (
  p_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.document_share_permission (
  p_document_id uuid
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select s.permission from public.document_shares s
  where s.document_id = p_document_id and s.recipient_user_id = (select auth.uid())
    and private.organization_role(s.organization_id) is not null;
$function$;

CREATE OR REPLACE FUNCTION private.organization_role (
  p_organization_id uuid
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select m.role from public.organization_memberships m
  where m.organization_id = p_organization_id and m.user_id = (select auth.uid());
$function$;

CREATE OR REPLACE FUNCTION private.project_role (
  p_project_id uuid
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select m.role from public.project_memberships m
  where m.project_id = p_project_id and m.user_id = (select auth.uid())
    and private.organization_role(m.organization_id) is not null;
$function$;

CREATE OR REPLACE FUNCTION public.create_organization (
  p_name text
)
  RETURNS uuid
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.create_organization(p_name); $function$;

REVOKE ALL ON FUNCTION "public"."create_organization"(text) FROM PUBLIC, "anon";

ALTER TABLE "public"."document_shares"
  ADD CONSTRAINT "document_shares_document_id_organization_id_fkey" FOREIGN KEY (document_id, organization_id) REFERENCES public.documents(id, organization_id) ON DELETE CASCADE;

ALTER TABLE "public"."document_shares"
  ADD CONSTRAINT "document_shares_organization_id_recipient_user_id_fkey" FOREIGN KEY (organization_id, recipient_user_id)
    REFERENCES public.organization_memberships(organization_id, user_id) ON DELETE CASCADE;

ALTER TABLE "public"."organization_memberships"
  ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."organization_memberships"
  ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."project_memberships"
  ADD CONSTRAINT "project_memberships_organization_id_user_id_fkey" FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_memberships(organization_id, user_id)
    ON DELETE CASCADE;

ALTER TABLE "public"."documents"
  ADD CONSTRAINT "documents_project_id_organization_id_fkey" FOREIGN KEY (project_id, organization_id) REFERENCES public.projects(id, organization_id) ON DELETE CASCADE;

ALTER TABLE "public"."project_memberships"
  ADD CONSTRAINT "project_memberships_project_id_organization_id_fkey" FOREIGN KEY (project_id, organization_id) REFERENCES public.projects(id, organization_id) ON DELETE CASCADE;

ALTER TABLE "public"."projects"
  ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX document_shares_organization_recipient_idx ON public.document_shares USING btree (organization_id, recipient_user_id);

CREATE INDEX document_shares_recipient_user_id_idx ON public.document_shares USING btree (recipient_user_id);

CREATE INDEX documents_organization_id_idx ON public.documents USING btree (organization_id);

CREATE INDEX documents_project_organization_idx ON public.documents USING btree (project_id, organization_id);

CREATE INDEX organization_memberships_user_id_idx ON public.organization_memberships USING btree (user_id);

CREATE INDEX project_memberships_organization_user_idx ON public.project_memberships USING btree (organization_id, user_id);

CREATE INDEX project_memberships_user_id_idx ON public.project_memberships USING btree (user_id);

CREATE INDEX projects_organization_id_idx ON public.projects USING btree (organization_id);

CREATE POLICY "project_managers_change_shares" ON "public"."document_shares"
  FOR UPDATE
  TO "authenticated"
  USING (private.can_share_document(document_id))
  WITH CHECK (private.can_share_document(document_id));

CREATE POLICY "project_managers_revoke_shares" ON "public"."document_shares"
  FOR DELETE
  TO "authenticated"
  USING (private.can_share_document(document_id));

CREATE POLICY "recipients_and_managers_read_shares" ON "public"."document_shares"
  FOR SELECT
  TO "authenticated"
  USING (((recipient_user_id = ( SELECT auth.uid() AS uid)) OR private.can_share_document(document_id)));

CREATE POLICY "eligible_editors_update_documents" ON "public"."documents"
  FOR UPDATE
  TO "authenticated"
  USING (private.can_edit_document(id, project_id, organization_id, state))
  WITH CHECK (private.can_read_document(id, project_id, organization_id, state));

CREATE POLICY "eligible_users_read_documents" ON "public"."documents"
  FOR SELECT
  TO "authenticated"
  USING (private.can_read_document(id, project_id, organization_id, state));

CREATE POLICY "admins_add_organization_members" ON "public"."organization_memberships"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((private.organization_role(organization_id) = 'admin'::text) AND (user_id <> ( SELECT auth.uid() AS uid))));

CREATE POLICY "admins_change_other_organization_roles" ON "public"."organization_memberships"
  FOR UPDATE
  TO "authenticated"
  USING (((private.organization_role(organization_id) = 'admin'::text) AND (user_id <> ( SELECT auth.uid() AS uid))))
  WITH CHECK (((private.organization_role(organization_id) = 'admin'::text) AND (user_id <> ( SELECT auth.uid() AS uid))));

CREATE POLICY "admins_remove_other_organization_members" ON "public"."organization_memberships"
  FOR DELETE
  TO "authenticated"
  USING (((private.organization_role(organization_id) = 'admin'::text) AND (user_id <> ( SELECT auth.uid() AS uid))));

CREATE POLICY "members_read_organization_roster" ON "public"."organization_memberships"
  FOR SELECT
  TO "authenticated"
  USING ((private.organization_role(organization_id) IS NOT NULL));

CREATE POLICY "admins_rename_organizations" ON "public"."organizations"
  FOR UPDATE
  TO "authenticated"
  USING ((private.organization_role(id) = 'admin'::text))
  WITH CHECK ((private.organization_role(id) = 'admin'::text));

CREATE POLICY "members_read_organizations" ON "public"."organizations"
  FOR SELECT
  TO "authenticated"
  USING ((private.organization_role(id) IS NOT NULL));

CREATE POLICY "admins_add_project_members" ON "public"."project_memberships"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((private.organization_role(organization_id) = 'admin'::text));

CREATE POLICY "admins_change_project_roles" ON "public"."project_memberships"
  FOR UPDATE
  TO "authenticated"
  USING ((private.organization_role(organization_id) = 'admin'::text))
  WITH CHECK ((private.organization_role(organization_id) = 'admin'::text));

CREATE POLICY "admins_remove_project_members" ON "public"."project_memberships"
  FOR DELETE
  TO "authenticated"
  USING ((private.organization_role(organization_id) = 'admin'::text));

CREATE POLICY "project_users_read_project_roster" ON "public"."project_memberships"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE (p.id = project_memberships.project_id))));

CREATE POLICY "admins_create_projects" ON "public"."projects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((private.organization_role(organization_id) = 'admin'::text));

CREATE POLICY "admins_update_projects" ON "public"."projects"
  FOR UPDATE
  TO "authenticated"
  USING ((private.organization_role(organization_id) = 'admin'::text))
  WITH CHECK ((private.organization_role(organization_id) = 'admin'::text));

CREATE POLICY "eligible_users_read_projects" ON "public"."projects"
  FOR SELECT
  TO "authenticated"
  USING (private.can_read_project(id, organization_id, visibility));

COMMENT ON COLUMN "public"."documents"."state" IS 'Drafts require editor/admin access or a direct share. Published and archived documents also permit project viewers. Archived documents cannot be edited, including by admins.';

COMMENT ON COLUMN "public"."projects"."visibility" IS 'Organization projects expose published and archived documents to organization members. Restricted projects require a project role or a document-specific share.';

COMMENT ON SCHEMA "private" IS 'Internal authorization helpers. Not exposed through the Data API.';

COMMENT ON TABLE "public"."document_shares" IS 'Direct document access within a tenant, including drafts. Does not confer project access or permission to reshare. Independent access paths can survive share revocation.';

COMMENT ON TABLE "public"."organization_memberships" IS 'Live tenant membership and organization role. Removing membership removes dependent project memberships and document shares.';

COMMENT ON TABLE "public"."organizations" IS 'Tenant boundary. Membership, not document authorship, establishes organization access.';

COMMENT ON TABLE "public"."project_memberships" IS 'Resource-scoped editor/viewer role. The member must belong to the same organization as the project.';

REVOKE ALL ON FUNCTION "private"."can_edit_document"(uuid, uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_edit_document"(uuid, uuid, uuid, text) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "private"."can_manage_project"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_manage_project"(uuid) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "private"."can_read_document"(uuid, uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_read_document"(uuid, uuid, uuid, text) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "private"."can_read_project"(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_read_project"(uuid, uuid, text) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "private"."can_share_document"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_share_document"(uuid) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "private"."create_organization"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."create_organization"(text) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "private"."document_share_permission"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."document_share_permission"(uuid) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "private"."organization_role"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."organization_role"(uuid) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "private"."project_role"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."project_role"(uuid) TO "authenticated", "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_organization"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_organization"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_organization"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_organization"(text) TO "service_role";

GRANT USAGE ON SCHEMA "private" TO "authenticated", "service_role";

REVOKE ALL ON TABLE "public"."document_shares" FROM "authenticated";

REVOKE ALL ("document_id") ON TABLE "public"."document_shares" FROM "authenticated";

GRANT INSERT ("document_id") ON TABLE "public"."document_shares" TO "authenticated";

REVOKE ALL ("organization_id") ON TABLE "public"."document_shares" FROM "authenticated";

GRANT INSERT ("organization_id") ON TABLE "public"."document_shares" TO "authenticated";

REVOKE ALL ("permission") ON TABLE "public"."document_shares" FROM "authenticated";

GRANT INSERT ("permission"), UPDATE ("permission") ON TABLE "public"."document_shares" TO "authenticated";

REVOKE ALL ("recipient_user_id") ON TABLE "public"."document_shares" FROM "authenticated";

GRANT INSERT ("recipient_user_id") ON TABLE "public"."document_shares" TO "authenticated";

GRANT DELETE, SELECT ON TABLE "public"."document_shares" TO "authenticated";

REVOKE ALL ON TABLE "public"."document_shares" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."document_shares" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."document_shares" TO "service_role";

REVOKE ALL ON TABLE "public"."documents" FROM "authenticated";

REVOKE ALL ("body") ON TABLE "public"."documents" FROM "authenticated";

GRANT INSERT ("body"), UPDATE ("body") ON TABLE "public"."documents" TO "authenticated";

REVOKE ALL ("organization_id") ON TABLE "public"."documents" FROM "authenticated";

GRANT INSERT ("organization_id") ON TABLE "public"."documents" TO "authenticated";

REVOKE ALL ("project_id") ON TABLE "public"."documents" FROM "authenticated";

GRANT INSERT ("project_id") ON TABLE "public"."documents" TO "authenticated";

REVOKE ALL ("state") ON TABLE "public"."documents" FROM "authenticated";

GRANT UPDATE ("state") ON TABLE "public"."documents" TO "authenticated";

REVOKE ALL ("title") ON TABLE "public"."documents" FROM "authenticated";

GRANT INSERT ("title"), UPDATE ("title") ON TABLE "public"."documents" TO "authenticated";

GRANT SELECT ON TABLE "public"."documents" TO "authenticated";

REVOKE ALL ON TABLE "public"."documents" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."documents" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."documents" TO "service_role";

REVOKE ALL ON TABLE "public"."organization_memberships" FROM "authenticated";

REVOKE ALL ("role") ON TABLE "public"."organization_memberships" FROM "authenticated";

GRANT UPDATE ("role") ON TABLE "public"."organization_memberships" TO "authenticated";

GRANT DELETE, INSERT, SELECT ON TABLE "public"."organization_memberships" TO "authenticated";

REVOKE ALL ON TABLE "public"."organization_memberships" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organization_memberships" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organization_memberships" TO "service_role";

REVOKE ALL ON TABLE "public"."organizations" FROM "authenticated";

REVOKE ALL ("name") ON TABLE "public"."organizations" FROM "authenticated";

GRANT UPDATE ("name") ON TABLE "public"."organizations" TO "authenticated";

GRANT SELECT ON TABLE "public"."organizations" TO "authenticated";

REVOKE ALL ON TABLE "public"."organizations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organizations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organizations" TO "service_role";

REVOKE ALL ON TABLE "public"."project_memberships" FROM "authenticated";

REVOKE ALL ("role") ON TABLE "public"."project_memberships" FROM "authenticated";

GRANT UPDATE ("role") ON TABLE "public"."project_memberships" TO "authenticated";

GRANT DELETE, INSERT, SELECT ON TABLE "public"."project_memberships" TO "authenticated";

REVOKE ALL ON TABLE "public"."project_memberships" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."project_memberships" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."project_memberships" TO "service_role";

REVOKE ALL ON TABLE "public"."projects" FROM "authenticated";

REVOKE ALL ("name") ON TABLE "public"."projects" FROM "authenticated";

GRANT INSERT ("name"), UPDATE ("name") ON TABLE "public"."projects" TO "authenticated";

REVOKE ALL ("organization_id") ON TABLE "public"."projects" FROM "authenticated";

GRANT INSERT ("organization_id") ON TABLE "public"."projects" TO "authenticated";

REVOKE ALL ("visibility") ON TABLE "public"."projects" FROM "authenticated";

GRANT INSERT ("visibility"), UPDATE ("visibility") ON TABLE "public"."projects" TO "authenticated";

GRANT SELECT ON TABLE "public"."projects" TO "authenticated";

REVOKE ALL ON TABLE "public"."projects" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."projects" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."projects" TO "service_role";

ALTER TABLE "public"."document_shares"
  ADD CONSTRAINT "document_shares_shared_by_fkey" FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX document_shares_shared_by_idx ON public.document_shares USING btree (shared_by);

CREATE POLICY "project_managers_grant_shares" ON "public"."document_shares"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((private.can_share_document(document_id) AND (shared_by = ( SELECT auth.uid() AS uid))));

ALTER TABLE "public"."documents"
  ADD CONSTRAINT "documents_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX documents_author_id_idx ON public.documents USING btree (author_id);

CREATE POLICY "project_editors_create_drafts" ON "public"."documents"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((private.can_manage_project(project_id) AND (author_id = ( SELECT auth.uid() AS uid)) AND (state = 'draft'::text)));

COMMENT ON COLUMN "public"."documents"."author_id" IS 'Attribution only; authorship never grants access. Set to null if the Auth user is deleted.';
