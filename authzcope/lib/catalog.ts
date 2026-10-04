import "server-only";

import { createHash } from "node:crypto";
import type { Client } from "pg";
import { catalogQueries, dependencyQuery } from "./catalog-queries.ts";
import type { CatalogAddress, CatalogDependency, CatalogKind, CatalogObject, DatabaseSnapshot, JsonObject } from "./catalog-types";

type CatalogRow = {
  class_id: string; object_id: string; sub_id: number; kind: CatalogKind;
  schema: string | null; name: string; identity: string; comment: string | null;
  definition: string | null; extension: string | null; details: JsonObject;
};
type DependencyRow = {
  from_class: number; from_object: number; from_sub: number;
  to_class: number; to_object: number; to_sub: number;
  from_identity: string; to_identity: string; dependency_type: string;
  source: CatalogDependency["source"];
};

// These are candidates, not evidence that everything in a provider schema is
// unmodified. Policies are kept, dependencies are promoted, and UI scope is editable.
const providerSchemas = new Set([
  "auth", "storage", "realtime", "_realtime", "supabase_functions", "supabase_migrations",
  "_analytics", "graphql", "graphql_public", "extensions", "vault", "pgsodium", "pgsodium_masks",
]);
const providerRoles = new Set(["postgres", "anon", "authenticated", "service_role", "authenticator"]);
const addressKey = (a: CatalogAddress) => `${a.classId}/${a.objectId}`;

export function catalogObjectId(kind: CatalogKind, identity: string): string {
  return `${kind}:${identity}`;
}

function normalizeObject(row: CatalogRow, supabase: boolean): CatalogObject {
  const system = row.schema?.startsWith("pg_") || row.schema === "information_schema" ||
    (row.kind === "role" && row.name.startsWith("pg_"));
  const provider = supabase && (providerSchemas.has(row.schema ?? "") ||
    (row.kind === "role" && (providerRoles.has(row.name) || row.name.startsWith("supabase_"))));
  const infrastructure = system || provider || Boolean(row.extension) || row.kind === "extension";
  const keepPolicy = row.kind === "policy";
  return {
    id: catalogObjectId(row.kind, row.identity),
    kind: row.kind, schema: row.schema, name: row.name, identity: row.identity,
    address: { classId: Number(row.class_id), objectId: Number(row.object_id), subId: row.sub_id },
    comment: row.comment, definition: row.definition, extension: row.extension, details: row.details,
    defaultIncluded: !infrastructure || keepPolicy,
    scopeReason: keepPolicy ? "Authorization policy retained, including on provider tables."
      : system ? "Postgres system infrastructure candidate."
      : row.extension || row.kind === "extension" ? "Extension infrastructure candidate; review before including."
      : provider ? "Provider infrastructure candidate; review before including."
      : "Application or uncertain origin; included conservatively.",
  };
}

export async function collectDatabaseSnapshot(client: Client): Promise<DatabaseSnapshot> {
  // The caller owns a repeatable-read, read-only transaction and client lifetime.
  await client.query("SET LOCAL search_path = pg_catalog");
  const { rows: [server] } = await client.query<{ version: string; version_number: string }>(
    "SELECT current_setting('server_version') AS version, current_setting('server_version_num') AS version_number",
  );
  const rows: CatalogRow[] = [];
  for (const query of catalogQueries) {
    const result = await client.query<CatalogRow>(query.sql);
    rows.push(...result.rows);
    if (result.rows.length > 10_000 || rows.length > 10_000) {
      throw new Error("Catalog exceeds the 10000 object collection limit.");
    }
  }
  const supabase = rows.some((row) => row.kind === "schema" && row.name === "auth") &&
    rows.some((row) => row.kind === "schema" && row.name === "storage") &&
    rows.some((row) => row.kind === "role" && row.name === "service_role");
  const objects = rows.map((row) => normalizeObject(row, supabase)).sort((a, b) => a.id.localeCompare(b.id));
  const objectsByAddress = new Map(objects.filter((o) => o.address.objectId !== 0)
    .map((o) => [addressKey(o.address), o]));
  const addresses = objects.filter((o) => o.address.objectId !== 0).map((o) => ({
    class_id: o.address.classId, object_id: o.address.objectId,
  }));
  const dependencyRows = await client.query<DependencyRow>(dependencyQuery, [JSON.stringify(addresses)]);
  if (dependencyRows.rows.length > 50_000) throw new Error("Catalog exceeds the 50000 dependency limit.");
  const dependencies = dependencyRows.rows.map((d): CatalogDependency => {
    const from = { classId: d.from_class, objectId: d.from_object, subId: d.from_sub };
    const to = { classId: d.to_class, objectId: d.to_object, subId: d.to_sub };
    return {
      from, to, fromId: objectsByAddress.get(addressKey(from))?.id ?? null,
      toId: objectsByAddress.get(addressKey(to))?.id ?? null,
      fromIdentity: d.from_identity, toIdentity: d.to_identity,
      dependencyType: d.dependency_type, source: d.source,
    };
  });
  // Preserve dependencies of application objects, across provider/schema boundaries.
  const byId = new Map(objects.map((o) => [o.id, o]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of dependencies) {
      const from = edge.fromId ? byId.get(edge.fromId) : undefined;
      const to = edge.toId ? byId.get(edge.toId) : undefined;
      if (from?.defaultIncluded && to && !to.defaultIncluded) {
        to.defaultIncluded = true;
        to.scopeReason = "Catalog-recorded dependency of an included object.";
        changed = true;
      }
    }
  }
  const coverage: DatabaseSnapshot["coverage"] = {
    collectionOmissions: objects.filter((o) => o.kind === "schema" &&
      (o.name.startsWith("pg_") || o.name === "information_schema"))
      .map((o) => ({ identity: o.identity, reason: "System internals are represented by referenced identities, not full definitions." })),
    notes: [
      "Metadata only: no application rows, stored credentials, remote FDW credentials, or AI requests are collected.",
      "Definitions are database reconstructions. Repository SQL, documentation, intended behavior, and test results are separate evidence.",
      "Catalog dependencies omit some string-defined function body references and dynamic SQL. Absence of an edge is not proof of independence.",
      "Native routine implementations and aggregate bodies are not reconstructed; implicit array and table row types are represented by their parent metadata.",
      "Effective access is not evaluated. Default ACLs apply to new objects, and null object ACLs use built-in defaults. API exposure and request claims are not established by this scan.",
      "Infrastructure scope is provisional. All collected objects remain inspectable and can be included manually.",
    ],
  };
  // Revision tracks collected content, excluding time and catalog addresses.
  const revisionObjects = objects.map((object) => {
    const copy: Partial<CatalogObject> = { ...object };
    delete copy.address;
    return copy;
  });
  const revisionDependencies = dependencies.map((edge) => {
    const copy: Partial<CatalogDependency> = { ...edge };
    delete copy.from;
    delete copy.to;
    return copy;
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const content = JSON.stringify({
    serverVersion: server.version,
    objects: revisionObjects, dependencies: revisionDependencies, coverage,
  });
  if (Buffer.byteLength(content) > 10 * 1024 * 1024) throw new Error("Catalog exceeds the 10 MB snapshot limit.");
  return {
    formatVersion: 1, revision: createHash("sha256").update(content).digest("hex"),
    capturedAt: new Date().toISOString(), serverVersion: server.version,
    serverVersionNumber: Number(server.version_number), objects, dependencies, coverage,
  };
}
