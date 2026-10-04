# Intended authorization model

This document describes intended behavior. SQL files describe implementation;
tests verify representative allow/deny cases. AuthZcope should compare these
sources rather than infer intended behavior solely from the existing policies.

## Access rules

1. All application access requires authentication and live organization membership.
2. Organization admins can read every document in their organization.
3. Project editors can read all project documents and edit non-archived documents.
4. Project viewers can read published and archived project documents, not drafts.
5. Organization members can read published/archived documents in organization-wide projects.
6. Direct viewer/editor shares grant access to that document, including drafts.
7. Editor shares permit editing non-archived documents, but never managing shares or memberships.
8. Archived documents cannot be edited or unarchived through the client API.
9. Authorship provides no independent permission.
10. Only organization admins or project editors can grant/change/revoke document shares.
11. Share recipients must belong to the document's organization. A share does not reveal its project or siblings.
12. Access paths are additive: revoking a share removes only that path.
13. Only organization admins create/rename projects, change visibility, and manage project memberships.
14. Admins manage other organization members; they cannot demote or remove themselves.
15. Organization members may read their organization roster. Project rosters are visible to users who can read the project. Shares are visible only to their recipient and managers.

## SQL mapping

| Domain question | Helper | Enforcing policy |
| --- | --- | --- |
| Which tenant role do I hold? | `private.organization_role` | Organization and membership policies |
| Which project role do I hold? | `private.project_role` | Project/document helpers |
| Can I access this project? | `private.can_read_project` | `eligible_users_read_projects` |
| Can I author documents here? | `private.can_manage_project` | `project_editors_create_drafts` |
| Was this document shared with me? | `private.document_share_permission` | Document access helpers |
| Can I read this document? | `private.can_read_document` | `eligible_users_read_documents` |
| Can I edit this document? | `private.can_edit_document` | `eligible_editors_update_documents` |
| Can I manage document shares? | `private.can_share_document` | Share write policies |

Row-aware helpers accept candidate row attributes where necessary. This avoids
re-reading a newly inserted row through a statement snapshot, and distinguishes
the old row's UPDATE eligibility from the resulting row's WITH CHECK conditions.

## Integrity and privilege boundaries

- Composite foreign keys bind projects, documents, memberships, and shares to the same tenant.
- Column grants prevent rewriting identifiers, tenant/project relationships, authorship, recipients, grantors, and creation timestamps.
- Documents can be inserted only as drafts attributed to the current user.
- Removing organization membership cascades to project memberships and recipient shares.
- Client deletion is supported only for memberships and shares.
- Internal lookups use `SECURITY DEFINER` only to read protected authorization data without recursive RLS. They use an empty search path, qualified names, and caller-derived identity; they never accept a user ID to impersonate.
- `private` is not exposed through the Data API. Functions revoke default PUBLIC/anon execution and grant only the required authenticated/service access.
- `public.create_organization(p_name)` is an invoker wrapper for a private, authenticated bootstrap function, creating the organization and first admin atomically.
- Service-role/database-owner operations are trusted administrative operations and bypass the client rules. Do not use them as evidence that a client is authorized.

## Questions for AuthZcope

- Why can Maya edit Launch draft despite having only a project viewer role?
- Can Quinn see the project or neighboring documents through a direct share?
- Why can't Maya edit Previous launch despite its editor share?
- Does revoking Maya's Launch announcement share remove her access?
- Why can't Maya read Handbook revision even though she authored it?
- Why can Alice administer Acme but only read published content at Boreal?
