import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";
import { collectDatabaseSnapshot } from "../lib/catalog.ts";
import { catalogQueries, dependencyQuery } from "../lib/catalog-queries.ts";
import { resolveIntrospectionInput } from "../lib/introspection.ts";

function row(kind, schema, name, oid, details = {}) {
  return { kind, schema, name, identity: schema ? `${schema}.${name}` : name,
    class_id: "1259", object_id: String(oid), sub_id: 0,
    comment: null, definition: null, extension: null, details };
}
function fakeClient(objects, dependencies = []) {
  return { query: async (sql) => {
    if (sql.includes("AS version_number")) return { rows: [{ version: "17.6", version_number: "170006" }] };
    if (sql === dependencyQuery) return { rows: dependencies };
    // Collection normalization can be tested independently of SQL extraction.
    return { rows: sql === catalogQueries[0].sql ? objects : [] };
  } };
}

test("unknown domains remain in scope and provider dependencies survive culling", async () => {
  const objects = [row("schema", null, "auth", 1), row("schema", null, "storage", 2),
    row("role", null, "service_role", 3), row("schema", null, "pg_catalog", 4),
    row("relation", "laboratory", "specimens", 5), row("routine", "auth", "identity", 6),
    row("relation", "storage", "objects", 7), row("policy", "storage", "custom-rule", 8),
    row("routine", "auth", "unused", 9)];
  const dependency = { from_class: 1259, from_object: 5, from_sub: 1,
    to_class: 1259, to_object: 6, to_sub: 0,
    from_identity: "laboratory.specimens.value", to_identity: "auth.identity",
    dependency_type: "n", source: "pg_depend" };
  const snapshot = await collectDatabaseSnapshot(fakeClient(objects, [dependency]));
  const find = (name) => snapshot.objects.find((o) => o.name === name);
  assert.equal(find("specimens").defaultIncluded, true);
  assert.equal(find("identity").defaultIncluded, true);
  assert.equal(find("objects").defaultIncluded, false);
  assert.equal(find("unused").defaultIncluded, false);
  assert.equal(find("custom-rule").defaultIncluded, true);
  assert.equal(snapshot.objects.length, objects.length);
  assert.equal(snapshot.dependencies[0].fromId, "relation:laboratory.specimens");
  assert.equal(snapshot.dependencies[0].from.subId, 1);
  assert.ok(snapshot.coverage.collectionOmissions.some((o) => o.identity === "pg_catalog"));
  const again = await collectDatabaseSnapshot(fakeClient(objects, [dependency]));
  assert.equal(snapshot.revision, again.revision);
  const shifted = objects.map((o) => ({ ...o, object_id: String(Number(o.object_id) + 100) }));
  const moved = { ...dependency, from_object: 105, to_object: 106 };
  assert.equal((await collectDatabaseSnapshot(fakeClient(shifted, [moved]))).revision, snapshot.revision);
});

test("an ambiguous schema name alone does not exclude application objects", async () => {
  const snapshot = await collectDatabaseSnapshot(fakeClient([row("relation", "auth", "patients", 1)]));
  assert.equal(snapshot.objects[0].defaultIncluded, true);
});

test("oversized catalog imports fail explicitly rather than quietly dropping evidence", async () => {
  const objects = Array.from({ length: 10001 }, (_, i) => row("relation", "custom", `item${i}`, i));
  await assert.rejects(collectDatabaseSnapshot(fakeClient(objects)), /collection limit/);
});

test("real database snapshot preserves the SaaS example's authorization evidence", {
  skip: !process.env.AUTHZCOPE_TEST_SAAS_DATABASE_URL,
}, async () => {
  const resolved = resolveIntrospectionInput({ connectionString: process.env.AUTHZCOPE_TEST_SAAS_DATABASE_URL });
  assert.equal(resolved.ok, true);
  const client = new Client(resolved.database);
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = await collectDatabaseSnapshot(client);
    const documents = snapshot.objects.find((o) => o.kind === "relation" && o.identity === "public.documents");
    assert.ok(documents, "local SaaS example documents table exists");
    assert.equal(documents.details.rlsEnabled, true);
    assert.ok(documents.details.columns.some((c) => c.name === "body" && c.type === "text"));
    assert.ok(documents.details.columns.some((c) => c.name === "title" &&
      c.grants.some((g) => g.grantee === "authenticated" && g.privilege === "UPDATE")));
    const policies = snapshot.objects.filter((o) => o.kind === "policy" && o.details.relation === "public.documents");
    assert.ok(policies.some((p) => p.details.command === "SELECT" && p.details.roles.includes("authenticated")));
    assert.ok(policies.some((p) => p.definition.includes("private.")));
    const helper = snapshot.objects.find((o) => o.kind === "routine" && o.schema === "private" && o.details.securityDefiner);
    assert.ok(helper?.definition.includes("auth.uid()"));
    assert.ok(helper.details.settings.some((s) => s.startsWith("search_path=")));
    assert.equal(helper.details.grants.some((g) => g.grantee === "PUBLIC" && g.privilege === "EXECUTE"), false);
    const foreignKey = snapshot.objects.find((o) => o.kind === "constraint" &&
      o.details.relation === "public.documents" && o.details.constraintKind === "f");
    assert.ok(foreignKey.details.referencedRelation);
    assert.equal(foreignKey.details.columns.length, foreignKey.details.referencedColumns.length);
    assert.ok(snapshot.dependencies.some((d) => d.fromId && d.toId));
    assert.equal(new Set(snapshot.objects.map((o) => o.id)).size, snapshot.objects.length);
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
    const again = await collectDatabaseSnapshot(client);
    assert.equal(again.revision, snapshot.revision);
    await client.query("COMMIT");
  } finally { await client.end(); }
});
