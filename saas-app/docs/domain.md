# Workspace document application

This is a small SaaS application and an authorization example for AuthZcope.
Its concepts have business meaning independent of their SQL implementation.

An **organization** is a tenant. A person can belong to several organizations
and have a different role in each. An **organization admin** manages that
organization's projects and memberships. An **organization member** has no
administrative authority simply because they are authenticated.

A **project** groups documents. An organization-wide project makes its
published and archived documents readable to all organization members.
A restricted project requires a project membership for general access.
Project editors work on documents; project viewers read published material.

A **document** has an author, content, and a lifecycle: draft, published,
archived. Authorship records attribution, not entitlement. Drafts are limited
to admins, project editors, and direct-share recipients. Archived content is
read-only even for admins. An eligible editor may publish or archive a document;
archiving is terminal through the client API.

A **share** grants one organization member access to one document, including
drafts. A viewer share permits reading. An editor share also permits editing
non-archived content, publishing, and archiving. Shares grant neither project
access nor access to neighboring documents nor permission to reshare.
Only organization admins and project editors can manage shares.

Access paths are additive. Removing one share does not cancel access through a
project role or organization role. Removing organization membership cancels all
access in that tenant and deletes dependent project memberships and shares.
Shares persist if the grantor loses their role; they are document permissions,
not delegated permissions that depend on the grantor's continued authority.

Organization/project/document deletion, invitations, external sharing,
share expiry, and billing are outside the initial client API.

## Demo people

| Person | Acme Research | Boreal Studio | Additional access |
| --- | --- | --- | --- |
| Alice | Admin | Member / project viewer | No Boreal admin powers |
| Ben | Member / project editor | None | Can manage Acme document shares |
| Maya | Member / Launch Planning viewer | None | Editor share on Launch draft and Previous launch |
| Quinn | Member, no project role | None | Viewer share on Launch draft |
| Nora | None | Admin | No access to Acme |

Every local demo account has `<name>@example.test` as its email and
`AuthzcopeDemo2026!` as its password. These fixtures are only for local development.
