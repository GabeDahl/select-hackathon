import type { DatabaseSnapshot } from "./catalog-types";

export type IntrospectionInput = {
  connectionString?: string;
};

export type ConfigurationStatus = {
  databaseConfigured: boolean;
  aiApiKeyConfigured: boolean;
};

export type IntrospectionResult =
  | {
      ok: true;
      stage: "introspection";
      databaseSource: "environment" | "input";
      snapshot: DatabaseSnapshot;
    }
  | {
      ok: false;
      message: string;
      databaseConnected?: boolean;
      fieldErrors?: Partial<Record<keyof IntrospectionInput, string>>;
    };
