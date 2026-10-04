import { createStore } from "zustand/vanilla";
import type { CatalogObject, DatabaseSnapshot } from "./catalog-types";
import type { IntrospectionInput, IntrospectionResult } from "./introspection-types";

export type SchemaFilters = {
  search: string;
  kind: "relation" | "routine" | "policy" | "all";
  showInfrastructure: boolean;
};

export type WorkspaceState = {
  configured: boolean;
  connectionString: string;
  result: IntrospectionResult | null;
  pending: boolean;
  snapshot: DatabaseSnapshot | null;
  selectedObjectId: string | null;
  schemaFilters: SchemaFilters;
  scopeOverrides: Record<string, boolean>;
  updateConnectionString: (value: string) => void;
  testConnection: () => Promise<void>;
  selectObject: (id: string) => void;
  setSchemaFilters: (filters: Partial<SchemaFilters>) => void;
  setObjectIncluded: (id: string, included: boolean) => void;
};

type IntrospectionTransport = (input: IntrospectionInput) => Promise<IntrospectionResult>;

// One store per provider instance, never a singleton shared by server requests.
// Credentials are request parameters, not query-cache keys; no persistence/devtools.
export function createWorkspaceStore(configured: boolean, introspect: IntrospectionTransport) {
  let generation = 0;
  return createStore<WorkspaceState>()((set, get) => ({
    configured, connectionString: "", result: null, pending: false, snapshot: null,
    selectedObjectId: null, scopeOverrides: {},
    schemaFilters: { search: "", kind: "relation", showInfrastructure: false },
    updateConnectionString(value) {
      generation += 1;
      set({ connectionString: value, result: null, pending: false, snapshot: null,
        selectedObjectId: null, scopeOverrides: {} });
    },
    async testConnection() {
      if (get().pending) return;
      const request = ++generation;
      const connectionString = get().connectionString;
      set({ pending: true, result: null });
      let result: IntrospectionResult;
      try { result = await introspect({ connectionString }); }
      catch { result = { ok: false, message: "The schema request failed. Please try again." }; }
      // A response for old credentials must never hydrate the current workspace.
      if (request !== generation) return;
      if (!result.ok) {
        // Same-database refresh failures retain the last snapshot, visibly stale.
        set({ pending: false, result });
        return;
      }
      const ids = new Set(result.snapshot.objects.map((o) => o.id));
      const previous = get();
      set({ pending: false, result, snapshot: result.snapshot,
        selectedObjectId: previous.selectedObjectId && ids.has(previous.selectedObjectId)
          ? previous.selectedObjectId
          : result.snapshot.objects.find((o) => o.kind === "relation" && o.defaultIncluded)?.id ?? null,
        scopeOverrides: Object.fromEntries(Object.entries(previous.scopeOverrides).filter(([id]) => ids.has(id))),
      });
    },
    selectObject(id) {
      const object = get().snapshot?.objects.find((o) => o.id === id);
      if (!object) return;
      const filters = get().schemaFilters;
      set({ selectedObjectId: id, schemaFilters: {
        ...filters,
        kind: filters.kind === "all" || object.kind === filters.kind ? filters.kind : "all",
        search: object.identity.toLowerCase().includes(filters.search.toLowerCase()) ? filters.search : "",
        showInfrastructure: filters.showInfrastructure || !object.defaultIncluded,
      } });
    },
    setSchemaFilters(filters) {
      set((state) => ({ schemaFilters: { ...state.schemaFilters, ...filters } }));
    },
    setObjectIncluded(id, included) {
      if (!get().snapshot?.objects.some((o) => o.id === id)) return;
      set((state) => ({ scopeOverrides: { ...state.scopeOverrides, [id]: included } }));
    },
  }));
}

export function isObjectIncluded(object: CatalogObject, overrides: Record<string, boolean>) {
  return overrides[object.id] ?? object.defaultIncluded;
}

export function selectVisibleObjects(snapshot: DatabaseSnapshot, filters: SchemaFilters, overrides: Record<string, boolean> = {}) {
  const search = filters.search.trim().toLowerCase();
  return snapshot.objects.filter((o) =>
    (filters.kind === "all" || o.kind === filters.kind) &&
    (filters.showInfrastructure || o.defaultIncluded || overrides[o.id] === true) &&
    (!search || `${o.identity} ${o.comment ?? ""}`.toLowerCase().includes(search)));
}
