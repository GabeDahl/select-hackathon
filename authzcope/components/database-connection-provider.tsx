"use client";

import { createContext, startTransition, useContext, useState } from "react";
import { useStore } from "zustand";

import { introspectDatabase } from "@/app/actions/introspect-database";
import { createWorkspaceStore, type WorkspaceState } from "@/lib/workspace-store";

const WorkspaceContext = createContext<ReturnType<typeof createWorkspaceStore> | null>(null);

export function DatabaseConnectionProvider({ configured, children }: {
  configured: boolean; children: React.ReactNode;
}) {
  const [store] = useState(() => createWorkspaceStore(configured, (input) =>
    new Promise((resolve, reject) => {
      startTransition(async () => {
        try { resolve(await introspectDatabase(input)); }
        catch (error) { reject(error); }
      });
    })));
  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceStoreApi() {
  const store = useContext(WorkspaceContext);
  if (!store) throw new Error("Workspace state requires DatabaseConnectionProvider.");
  return store;
}

export function useWorkspaceStore<T>(selector: (state: WorkspaceState) => T): T {
  return useStore(useWorkspaceStoreApi(), selector);
}

// Compatibility adapter for the form/header. New features select only their fields.
export function useDatabaseConnection() {
  const configured = useWorkspaceStore((s) => s.configured);
  const connectionString = useWorkspaceStore((s) => s.connectionString);
  const result = useWorkspaceStore((s) => s.result);
  const pending = useWorkspaceStore((s) => s.pending);
  const updateConnectionString = useWorkspaceStore((s) => s.updateConnectionString);
  const testConnection = useWorkspaceStore((s) => s.testConnection);
  const status: "testing" | "verified" | "failed" | "untested" | "unconfigured" = pending ? "testing"
    : result ? (result.ok ? "verified" : "failed")
    : configured || connectionString.trim() ? "untested" : "unconfigured";
  return { configured, connectionString, result, pending, status, updateConnectionString, testConnection };
}
