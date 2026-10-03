import "server-only";

import { Client, type ClientConfig } from "pg";

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
  const aiModel = typeof values.aiModel === "string" ? values.aiModel.trim() : "";
  const aiApiKey = process.env.AI_API_KEY?.trim() || (
    typeof values.aiApiKey === "string" ? values.aiApiKey.trim() : ""
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
  if (!aiModel || aiModel.length > 200) {
    fieldErrors.aiModel = "Enter a model identifier of up to 200 characters.";
  }
  if (!aiApiKey || aiApiKey.length > 8_192) {
    fieldErrors.aiApiKey = "Provide an AI API key, or configure one on the server.";
  }
  if (Object.keys(fieldErrors).length || !database) {
    return { ok: false as const, message: "Check the connection settings.", fieldErrors };
  }

  return {
    ok: true as const,
    database,
    databaseSource: environmentUrl ? "environment" as const : "input" as const,
    ai: { model: aiModel, apiKey: aiApiKey },
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
  try {
    client = new Client(settings.database);
    // A disconnect between queries must not become an unhandled process error.
    client.on("error", () => {});
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SELECT 1");
    // Catalog collection will go here. No application rows or AI requests yet.
    await client.query("COMMIT");

    return {
      ok: true,
      stage: "connection",
      databaseSource: settings.databaseSource,
      aiModel: settings.ai.model,
      aiApiKeyConfigured: true,
    };
  } catch (error) {
    return { ok: false, message: connectionError(error) };
  } finally {
    // Closing also rolls back any transaction interrupted by an error.
    await client?.end().catch(() => {});
  }
}
