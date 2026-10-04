import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { Client } from "pg";

import {
  getConfigurationStatus,
  resolveIntrospectionInput,
  runIntrospection,
} from "../lib/introspection.ts";

const originalEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  AI_API_KEY: process.env.AI_API_KEY,
};
const input = {
  connectionString: "postgresql://reader:private-password@localhost:5432/example",
};

beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.AI_API_KEY;
});

afterEach(() => {
  mock.restoreAll();
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("uses supplied credentials when environment settings are absent", () => {
  const resolved = resolveIntrospectionInput(input);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.databaseSource, "input");
  assert.equal(resolved.database.password, "private-password");
  assert.deepEqual(getConfigurationStatus(), {
    databaseConfigured: false,
    aiApiKeyConfigured: false,
  });
});

test("environment secrets take precedence and only presence is exposed", () => {
  process.env.DATABASE_URL = "postgres://server:server-secret@database:5432/application";
  process.env.AI_API_KEY = "server-ai-secret";
  const resolved = resolveIntrospectionInput({ ...input, connectionString: "invalid" });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.databaseSource, "environment");
  assert.equal(resolved.database.host, "database");
  assert.equal(resolved.database.password, "server-secret");
  assert.deepEqual(getConfigurationStatus(), {
    databaseConfigured: true,
    aiApiKeyConfigured: true,
  });
});

test("rejects missing and malformed runtime inputs before connecting", () => {
  assert.deepEqual(Object.keys(resolveIntrospectionInput(null).fieldErrors).sort(),
    ["connectionString"]);
  for (const connectionString of [
    "https://reader:password@example.com/db",
    "postgres://localhost/db",
    "postgres://reader@localhost",
    "postgres://reader@localhost:99999/db",
    "postgres://reader@localhost/db?sslrootcert=/private/file",
    "postgres://reader@localhost/db?sslmode=no-verify",
  ]) {
    assert.equal(resolveIntrospectionInput({ ...input, connectionString }).ok, false);
  }
});

test("database validation ignores absent or invalid AI settings", () => {
  process.env.AI_API_KEY = "x".repeat(8193);
  const resolved = resolveIntrospectionInput({ ...input, aiModel: null, aiApiKey: 123 });
  assert.equal(resolved.ok, true);
  assert.equal("ai" in resolved, false);
});

test("decodes credentials and enforces certificate verification for TLS", () => {
  const resolved = resolveIntrospectionInput({
    ...input,
    connectionString: "postgres://reader:p%40ss%3Aword@[::1]:5432/db?sslmode=verify-full",
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.database.host, "::1");
  assert.equal(resolved.database.password, "p@ss:word");
  assert.deepEqual(resolved.database.ssl, { rejectUnauthorized: true });
});

test("collects metadata in a read-only transaction, closes it, and returns no credentials", async () => {
  const queries = [];
  mock.method(Client.prototype, "connect", async () => {});
  mock.method(Client.prototype, "query", async (sql) => {
    queries.push(sql);
    return { rows: sql.includes("AS version_number") ? [{ version: "17.6", version_number: "170006" }] : [] };
  });
  const end = mock.method(Client.prototype, "end", async () => {});
  const fetch = mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected AI request"); });
  const result = await runIntrospection(input);
  assert.equal(result.ok, true);
  assert.equal(result.stage, "introspection");
  assert.equal(queries[0], "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(queries.at(-1), "COMMIT");
  assert.ok(queries.some((sql) => sql.includes("pg_catalog.pg_policy")));
  assert.equal(result.snapshot.serverVersionNumber, 170006);
  assert.equal(result.snapshot.formatVersion, 1);
  assert.match(result.snapshot.revision, /^[a-f0-9]{64}$/);
  assert.equal(end.mock.callCount(), 1);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal("aiModel" in result, false);
  assert.equal("aiApiKeyConfigured" in result, false);
  assert.equal(JSON.stringify(result).includes("private-password"), false);
});

test("reports a connected database separately from a failed catalog import", async () => {
  const queries = [];
  mock.method(Client.prototype, "connect", async () => {});
  mock.method(Client.prototype, "query", async (sql) => {
    queries.push(sql);
    if (sql.startsWith("SET LOCAL")) throw new Error(`sensitive catalog error ${input.connectionString}`);
    return { rows: [] };
  });
  const end = mock.method(Client.prototype, "end", async () => {});
  const result = await runIntrospection(input);
  assert.equal(result.ok, false);
  assert.equal(result.databaseConnected, true);
  assert.equal(queries.includes("COMMIT"), false);
  assert.equal(JSON.stringify(result).includes("private-password"), false);
  assert.equal(end.mock.callCount(), 1);
});

test("redacts driver errors and closes failed connections", async () => {
  mock.method(Client.prototype, "connect", async () => {
    throw new Error(`Driver failure containing ${input.connectionString}`);
  });
  const end = mock.method(Client.prototype, "end", async () => {});
  const result = await runIntrospection(input);
  assert.equal(result.ok, false);
  assert.equal("aiModel" in result, false);
  assert.equal("aiApiKeyConfigured" in result, false);
  assert.equal(JSON.stringify(result).includes(input.connectionString), false);
  assert.equal(end.mock.callCount(), 1);
});

test("closes the connection after a query failure", async () => {
  mock.method(Client.prototype, "connect", async () => {});
  mock.method(Client.prototype, "query", async () => {
    throw Object.assign(new Error("sensitive server detail"), { code: "57014" });
  });
  const end = mock.method(Client.prototype, "end", async () => {});
  assert.deepEqual(await runIntrospection(input), {
    ok: false, message: "The database connection check timed out.",
  });
  assert.equal(end.mock.callCount(), 1);
});

test("connects to a real Postgres database using input and environment fallback", {
  skip: !process.env.AUTHZCOPE_TEST_DATABASE_URL,
}, async () => {
  const connectionString = process.env.AUTHZCOPE_TEST_DATABASE_URL;
  assert.equal((await runIntrospection({ ...input, connectionString })).ok, true);
  process.env.DATABASE_URL = connectionString;
  const result = await runIntrospection({});
  assert.equal(result.ok, true);
  assert.equal(result.databaseSource, "environment");
});
