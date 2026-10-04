import type { CatalogObject } from "./catalog-types.ts";

// Prompt projections have short source aliases. Original objects and evidence
// pointers stay on the server; no raw ACLs or repeated catalog envelopes travel.
export function projectAnalysisSource(source: Partial<CatalogObject> & { text?: string }, includeColumns = true) {
  if (source.text !== undefined) return { text: source.text };
  const details = source.details ?? {};
  const grants = (value: unknown) => {
    if (!Array.isArray(value)) return value;
    const grouped: Record<string, string[]> = {};
    for (const grant of value) if (grant && typeof grant === "object" && typeof grant.grantee === "string") {
      (grouped[grant.grantee] ??= []).push(`${grant.privilege}${grant.grantable ? " WITH GRANT OPTION" : ""}`);
    }
    return grouped;
  };
  const result: Record<string, unknown> = { name: source.identity, kind: source.kind };
  if (source.definition) result.sql = source.definition;
  if (source.comment) result.comment = source.comment;
  const keys = source.kind === "relation"
    ? ["owner", "rlsEnabled", "rlsForced", "options", "grants"]
    : source.definition ? ["owner", "securityDefiner", "settings", "grants", "relation", "command", "roles", "internal"]
    : ["owner", "grants", "superuser", "bypassRls", "inherits", "role", "member", "adminOption", "inheritOption", "setOption", "enumValues"];
  for (const key of keys) if (details[key] !== undefined && details[key] !== null) result[key] = key === "grants" ? grants(details[key]) : details[key];
  if (includeColumns && Array.isArray(details.columns)) {
    result.columns = details.columns.map((column) => {
      if (!column || typeof column !== "object" || Array.isArray(column)) return column;
      return Object.fromEntries(["name", "type", "nullable", "defaultExpression", "identity", "generated", "grants"]
        .filter((key) => column[key] !== undefined && column[key] !== null && column[key] !== "" && (!Array.isArray(column[key]) || column[key].length))
        .map((key) => [key, key === "grants" ? grants(column[key]) : column[key]]));
    });
  }
  return result;
}
