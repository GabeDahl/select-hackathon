import type { CatalogObject, DatabaseSnapshot } from "./catalog-types.ts";

const supabaseSchemas = new Set([
  "auth", "storage", "realtime", "_realtime", "supabase_functions", "supabase_migrations", "_analytics",
  "graphql", "graphql_public", "extensions", "vault", "pgsodium", "pgsodium_masks", "pgbouncer",
]);
const supabaseRoles = new Set(["postgres", "anon", "authenticated", "service_role", "authenticator", "dashboard_user", "pgbouncer"]);

export function hasSupabasePlatform(snapshot: DatabaseSnapshot) {
  return snapshot.objects.some((item) => item.kind === "schema" && item.name === "auth") &&
    snapshot.objects.some((item) => item.kind === "schema" && item.name === "storage") &&
    snapshot.objects.some((item) => item.kind === "role" && item.name === "service_role");
}

// These are context hints, never proof of origin or an automatic permission
// exclusion. Custom policies in platform schemas must still be interpreted.
export function catalogOriginHint(object: CatalogObject, supabase: boolean) {
  const schema = object.schema ?? (object.kind === "schema" ? object.name : "");
  if (schema.startsWith("pg_") || schema === "information_schema" ||
    object.kind === "trigger" && object.details.internal === true ||
    object.kind === "role" && object.name.startsWith("pg_")) return "postgres_internal";
  if (object.extension || object.kind === "extension") return "extension";
  const platformRole = (name: unknown) => typeof name === "string" &&
    (supabaseRoles.has(name) || name.startsWith("supabase_") || name.startsWith("pg_"));
  if (supabase && (supabaseSchemas.has(schema) ||
    object.kind === "role" && platformRole(object.name) ||
    object.kind === "role_membership" && platformRole(object.details.role) && platformRole(object.details.member) ||
    object.kind === "default_privileges" && platformRole(object.details.owner))) return "supabase_candidate";
  return "application_or_unknown";
}
