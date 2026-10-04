import type { CatalogObject, DatabaseSnapshot } from "./catalog-types.ts";
import { catalogOriginHint, hasSupabasePlatform } from "./catalog-origin.ts";

/** Select application implementation, not the transitive closure of a database.
 * The complete catalog and dependency graph stay in the introspection snapshot.
 */
export function selectAnalysisEvidence(snapshot: DatabaseSnapshot, overrides: Record<string, boolean>) {
  const supabase = hasSupabasePlatform(snapshot);
  const byId = new Map(snapshot.objects.map((object) => [object.id, object]));
  const origin = (object: CatalogObject) => catalogOriginHint(object, supabase);
  const applicationSchemas = new Set(snapshot.objects.filter((object) =>
    object.kind === "relation" && origin(object) === "application_or_unknown",
  ).map((object) => object.schema));
  const includedIds = snapshot.objects.filter((object) => {
    if (object.id in overrides) return overrides[object.id];
    // Older snapshots promote platform dependencies to defaultIncluded. Origin
    // is checked independently so those promotions cannot seed another crawl.
    if (object.kind === "policy") return object.defaultIncluded;
    if (object.kind === "index" || origin(object) === "postgres_internal") return false;
    if (object.kind === "default_privileges" && applicationSchemas.has(object.schema)) return object.defaultIncluded;
    return object.defaultIncluded && origin(object) === "application_or_unknown";
  }).map((object) => object.id).sort();
  const included = new Set(includedIds), retained = new Set(includedIds);
  const edges = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    const targets = edges.get(from) ?? new Set<string>();
    targets.add(to);
    edges.set(from, targets);
  };
  const dependencyKinds = new Set(["relation", "routine", "role", "role_membership", "schema", "type", "policy"]);
  for (const edge of snapshot.dependencies) {
    const target = edge.toId ? byId.get(edge.toId) : undefined;
    if (edge.fromId && target && dependencyKinds.has(target.kind) && origin(target) !== "postgres_internal") link(edge.fromId, target.id);
  }
  for (const object of snapshot.objects) {
    const relation = typeof object.details.relation === "string" ? `relation:${object.details.relation}` : null;
    // Attach implementation only to selected resources. A referenced platform
    // relation is terminal: its foreign keys must not import the Auth catalog.
    if (relation && included.has(relation) && object.kind !== "index" && origin(object) !== "postgres_internal") link(relation, object.id);
    if (relation && object.kind === "policy") link(object.id, relation);
    if (object.kind === "constraint" && typeof object.details.referencedRelation === "string") link(object.id, `relation:${object.details.referencedRelation}`);
  }

  // pg_depend does not record many string-defined routine bodies. Retain named
  // SQL references as evidence without interpreting their authorization logic.
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const identifier = (name: string) => `(?:${escape(name)}|${escape(`"${name.replaceAll('"', '""')}"`)})`;
  const references = snapshot.objects.filter((object) => object.schema && ["routine", "relation"].includes(object.kind))
    .map((object) => ({ object, pattern: new RegExp(`(?<![\\w$])${identifier(object.schema!)}\\s*\\.\\s*${identifier(object.name)}(?![\\w$])`, "i") }));
  const roles = snapshot.objects.filter((object) => object.kind === "role");
  const memberships = snapshot.objects.filter((object) => object.kind === "role_membership");
  const queue = [...retained];
  const retain = (id: string) => {
    if (byId.has(id) && !retained.has(id)) { retained.add(id); queue.push(id); }
  };
  for (let index = 0; index < queue.length; index++) {
    const object = byId.get(queue[index])!;
    for (const id of edges.get(object.id) ?? []) retain(id);
    if (object.definition && ["routine", "policy", "trigger", "rule", "relation"].includes(object.kind)) {
      for (const reference of references) if (reference.pattern.test(object.definition)) retain(reference.object.id);
    }
    const names = new Set<string>();
    const findGrantees = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) { value.forEach(findGrantees); return; }
      const record = value as Record<string, unknown>;
      for (const key of ["owner", "grantee", "grantor"]) if (typeof record[key] === "string") names.add(record[key]);
      if (Array.isArray(record.roles)) for (const name of record.roles) if (typeof name === "string") names.add(name);
      Object.values(record).forEach(findGrantees);
    };
    findGrantees(object.details);
    for (const role of roles) if (names.has(role.name)) retain(role.id);
    if (object.kind === "role") {
      for (const membership of memberships) if (membership.details.member === object.name) {
        retain(membership.id);
        for (const role of roles) if (role.name === membership.details.role) retain(role.id);
      }
    }
  }
  return { includedIds, retained, supabase };
}
