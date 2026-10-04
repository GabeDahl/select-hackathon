import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore, selectVisibleObjects } from "../lib/workspace-store.ts";

function object(id, kind = "relation", defaultIncluded = true) {
  return { id, identity: id, kind, defaultIncluded, comment: null };
}
function success(objects, revision = "revision-1") {
  return { ok: true, stage: "introspection", databaseSource: "input",
    snapshot: { revision, objects, dependencies: [], coverage: { notes: [], collectionOmissions: [] } } };
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

test("hydrates an isolated workspace atomically and ignores duplicate pending requests", async () => {
  const response = deferred();
  const calls = [];
  const store = createWorkspaceStore(false, (input) => { calls.push(input); return response.promise; });
  const other = createWorkspaceStore(true, async () => success([]));
  store.getState().updateConnectionString("postgres://reader:password@database/application");
  const request = store.getState().testConnection();
  await store.getState().testConnection();
  assert.equal(calls.length, 1);
  assert.equal(store.getState().pending, true);
  assert.equal(other.getState().pending, false);
  response.resolve(success([object("custom.instruments")]));
  await request;
  assert.equal(store.getState().snapshot.objects[0].id, "custom.instruments");
  assert.equal(store.getState().selectedObjectId, "custom.instruments");
  assert.equal(store.getState().pending, false);
  assert.equal(other.getState().snapshot, null);
  assert.equal(calls[0].connectionString, store.getState().connectionString);
});

test("changing credentials clears the snapshot and discards any older response", async () => {
  const old = deferred();
  const current = deferred();
  const store = createWorkspaceStore(false, ({ connectionString }) => connectionString === "old" ? old.promise : current.promise);
  store.getState().updateConnectionString("old");
  const oldRequest = store.getState().testConnection();
  store.getState().updateConnectionString("current");
  const currentRequest = store.getState().testConnection();
  current.resolve(success([object("new.measurements")]));
  await currentRequest;
  old.resolve(success([object("old.measurements")]));
  await oldRequest;
  assert.equal(store.getState().snapshot.objects[0].id, "new.measurements");
  store.getState().updateConnectionString("third");
  assert.equal(store.getState().snapshot, null);
  assert.equal(store.getState().result, null);
  assert.equal(store.getState().selectedObjectId, null);
});

test("failed refresh retains evidence, while successful refresh reconciles selection and scope", async () => {
  const results = [
    success([object("a"), object("b"), object("internal.helper", "routine", false)]),
    { ok: false, databaseConnected: true, message: "Import failed" },
    success([object("b"), object("internal.helper", "routine", false)], "revision-2"),
    success([object("c")], "revision-3"),
  ];
  const store = createWorkspaceStore(true, async () => results.shift());
  await store.getState().testConnection();
  store.getState().selectObject("b");
  store.getState().setObjectIncluded("a", false);
  store.getState().setObjectIncluded("internal.helper", true);
  await store.getState().testConnection();
  assert.equal(store.getState().result.ok, false);
  assert.equal(store.getState().snapshot.revision, "revision-1");
  await store.getState().testConnection();
  assert.equal(store.getState().selectedObjectId, "b");
  assert.deepEqual(store.getState().scopeOverrides, { "internal.helper": true });
  await store.getState().testConnection();
  assert.equal(store.getState().selectedObjectId, "c");
  assert.deepEqual(store.getState().scopeOverrides, {});
});

test("dependency navigation reveals hidden evidence and scope includes are reversible", async () => {
  const store = createWorkspaceStore(true, async () => success([
    object("public.resource"), object("platform.uid", "routine", false),
  ]));
  await store.getState().testConnection();
  const visible = () => selectVisibleObjects(store.getState().snapshot, store.getState().schemaFilters, store.getState().scopeOverrides);
  assert.equal(visible().length, 1);
  store.getState().setSchemaFilters({ kind: "all" });
  store.getState().setObjectIncluded("platform.uid", true);
  assert.equal(visible().length, 2);
  store.getState().setObjectIncluded("platform.uid", false);
  assert.equal(visible().length, 1);
  store.getState().setSchemaFilters({ search: "resource", kind: "relation" });
  store.getState().selectObject("platform.uid");
  assert.equal(store.getState().schemaFilters.kind, "all");
  assert.equal(store.getState().schemaFilters.search, "");
  assert.equal(store.getState().schemaFilters.showInfrastructure, true);
  assert.equal(visible().length, 2);
  store.getState().selectObject("unknown");
  assert.equal(store.getState().selectedObjectId, "platform.uid");
});

test("transport failures become a sanitized state and permit retry", async () => {
  const store = createWorkspaceStore(true, async () => { throw new Error("secret connection credentials"); });
  await store.getState().testConnection();
  assert.equal(store.getState().pending, false);
  assert.equal(store.getState().result.ok, false);
  assert.equal(JSON.stringify(store.getState().result).includes("secret"), false);
});
