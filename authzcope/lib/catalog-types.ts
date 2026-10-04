// PostgreSQL evidence only. This is not the future AI domain/visualization model.
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export type CatalogKind =
  | "schema" | "relation" | "routine" | "type" | "policy" | "constraint"
  | "index" | "trigger" | "rule" | "role" | "role_membership"
  | "default_privileges" | "extension" | "operator" | "cast";

export type CatalogAddress = { classId: number; objectId: number; subId: number };

export type CatalogObject = {
  id: string;
  kind: CatalogKind;
  schema: string | null;
  name: string;
  identity: string;
  address: CatalogAddress;
  comment: string | null;
  definition: string | null;
  extension: string | null;
  details: JsonObject;
  defaultIncluded: boolean;
  scopeReason: string;
};

export type CatalogDependency = {
  fromId: string | null;
  toId: string | null;
  from: CatalogAddress;
  to: CatalogAddress;
  fromIdentity: string;
  toIdentity: string;
  dependencyType: string;
  source: "pg_depend" | "pg_shdepend";
};

export type DatabaseSnapshot = {
  formatVersion: 1;
  revision: string;
  capturedAt: string;
  serverVersion: string;
  serverVersionNumber: number;
  objects: CatalogObject[];
  dependencies: CatalogDependency[];
  coverage: {
    collectionOmissions: { identity: string; reason: string }[];
    notes: string[];
  };
};
