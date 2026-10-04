import "server-only";

import { Client, type ClientConfig } from "pg";
import { collectDatabaseSnapshot } from "./catalog.ts";

import type {
  ConfigurationStatus,
  IntrospectionInput,
  IntrospectionResult,
} from "./introspection-types";

export function getConfigurationStatus(): ConfigurationStatus {
  return {
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    aiApiKeyConfigured: Boolean(process.env.AI_API_KEY?.trim()),
  };
}

function connectionConfig(connectionString: string): ClientConfig | null {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");
    const port = url.port ? Number(url.port) : 5432;

    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      url.pathname.length < 2 ||
      url.hash ||
      !Number.isInteger(port) || port < 1 || port > 65_535 ||
      url.searchParams.getAll("sslmode").length > 1 ||
      (sslMode !== null && !["disable", "require", "verify-full"].includes(sslMode)) ||
      [...url.searchParams.keys()].some((key) => key !== "sslmode")
    ) {
      return null;
    }

    // Explicit fields avoid ambient PG* credentials and URL options that load
    // local certificate files. TLS verification is never silently disabled.
    return {
      host: url.hostname.replace(/^\[|\]$/g, ""),
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: sslMode && sslMode !== "disable" ? { rejectUnauthorized: true } : false,
      application_name: "authzcope-introspection",
      connectionTimeoutMillis: 5_000,
      query_timeout: 5_000,
      statement_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    };
  } catch {
    return null;
  }
}

export function resolveIntrospectionInput(input: unknown) {
  const values = input && typeof input === "object"
    ? input as Partial<Record<keyof IntrospectionInput, unknown>>
    : {};
  const environmentUrl = process.env.DATABASE_URL?.trim();
  const connectionString = environmentUrl || (
    typeof values.connectionString === "string" ? values.connectionString.trim() : ""
  );
  const fieldErrors: Partial<Record<keyof IntrospectionInput, string>> = {};
  const database = connectionString.length <= 8_192 ? connectionConfig(connectionString) : null;

  if (!connectionString) {
    fieldErrors.connectionString = "Enter a Postgres connection URL.";
  } else if (!database) {
    fieldErrors.connectionString = environmentUrl
      ? "The server database configuration is invalid."
      : "Use a postgres:// or postgresql:// URL with a host, username, and database. The supported URL option is sslmode=disable, require, or verify-full.";
  }
  if (Object.keys(fieldErrors).length || !database) {
    return { ok: false as const, message: "Check the connection settings.", fieldErrors };
  }

  return {
    ok: true as const,
    database,
    databaseSource: environmentUrl ? "environment" as const : "input" as const,
  };
}

function connectionError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  switch (code) {
    case "28P01":
    case "28000":
      return "Postgres rejected the database credentials.";
    case "3D000":
      return "The configured database does not exist.";
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "EHOSTUNREACH":
      return "The database could not be reached. Check its address and availability.";
    case "ETIMEDOUT":
    case "57014":
      return "The database connection check timed out.";
    default:
      // Driver messages can contain URLs, credentials, or server details.
      return "Unable to verify the database connection. Check the credentials, network, and TLS settings.";
  }
}

export async function runIntrospection(input: unknown): Promise<IntrospectionResult> {
  const settings = resolveIntrospectionInput(input);
  if (!settings.ok) return settings;

  let client: Client | undefined;
  let connected = false;
  try {
    client = new Client(settings.database);
    // A disconnect between queries must not become an unhandled process error.
    client.on("error", () => {});
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SELECT 1");
    connected = true;
    const snapshot = await collectDatabaseSnapshot(client);
    await client.query("COMMIT");

    return {
      ok: true,
      stage: "introspection",
      databaseSource: settings.databaseSource,
      snapshot,
    };
  } catch (error) {
    return connected
      ? { ok: false, databaseConnected: true, message: "Database connected, but schema introspection failed. Check catalog access and database size, then retry." }
      : { ok: false, message: connectionError(error) };
  } finally {
    // Closing also rolls back any transaction interrupted by an error.
    await client?.end().catch(() => {});
  }
}
