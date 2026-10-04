"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import {
  ArrowLeftIcon,
  FocusIcon,
  HandIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";

import { SelectionInspector, type ExplorerSelection } from "@/components/selection-inspector";
import { ExplorerEmptyState } from "@/components/explorer-empty-state";
import { useExplorerStore } from "@/components/explorer-navigation-provider";
import { useAnalysisStore } from "@/components/analysis-provider";
import { ExplorerQuestionInput, ExplorerChatAnswer } from "@/components/explorer-chat";
import { ExplorerModelDetails } from "@/components/explorer-model-details";
import type { NavigationCommand } from "@/lib/explorer-navigation-types";
import { Button } from "@/components/ui/button";
import { ExplorerControls, emptyExplorerControls, type ExplorerControl } from "@/components/explorer-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ExplorerScene = dynamic(() => import("@/components/explorer-scene"), {
  ssr: false,
  loading: () => <Skeleton className="absolute inset-0 rounded-none" />,
});

export function ExplorationWorkspace({ controls = emptyExplorerControls }: {
  controls?: readonly ExplorerControl[];
}) {
  const navigation = useExplorerStore((state) => state.navigation);
  const registry = useExplorerStore((state) => state.registry);
  const navigate = useExplorerStore((state) => state.navigate);
  const pending = useExplorerStore((state) => state.pending);
  const reply = useExplorerStore((state) => state.reply);
  const error = useExplorerStore((state) => state.error);
  const clearConversation = useExplorerStore((state) => state.clearConversation);
  const model = useAnalysisStore((state) => state.model);
  const { view } = navigation;
  const target = navigation.inspected ?? navigation.focus;
  const entry = registry.entries.find((entry) => entry.target.id === target?.id && entry.target.kind === target?.kind);
  const selection: ExplorerSelection | null = entry ? {
    id: entry.target.id, label: entry.label, kind: entry.target.kind, state: "", location: "",
  } : null;
  const inspectorOpen = !!selection || pending || !!reply || !!error;
  const command = (commands: NavigationCommand[]) => navigate({ revision: registry.revision, commands });
  const pattern = registry.patterns.find((pattern) => pattern.id === navigation.patternId);
  const compare = () => { if (pattern?.scenarioIds.length) command([{ type: "compare", patternId: pattern.id, scenarioIds: pattern.scenarioIds.slice(0, 4) }]); };
  const defaultControls = controls === emptyExplorerControls;
  const availableControls: readonly ExplorerControl[] = defaultControls ? [
    { id: "access-pattern", label: "Access action", kind: "navigation", placeholder: "Select action", options: registry.patterns.map((pattern) => ({ id: pattern.id,
      label: registry.entries.find((entry) => entry.target.kind === "pattern" && entry.target.id === pattern.id)?.label ?? pattern.id })) },
    { id: "scenario", label: "Scenario", kind: "scenario", placeholder: navigation.scenarioIds.length > 1 ? "Comparing scenarios" : "Select scenario",
      options: (pattern?.scenarioIds ?? []).map((id) => ({ id, label: registry.entries.find((entry) => entry.target.kind === "scenario" && entry.target.id === id)?.label ?? id })) },
  ] : controls;
  const [controlValues, setControlValues] = useState<Record<string, string | null>>({});
  const selectionButtonRef = useRef<HTMLButtonElement>(null);

  if (!model) return <ExplorerEmptyState />;

  return (
    <div className="flex h-full min-h-0 min-w-0">
      <section className={`dark model-space relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground ${inspectorOpen ? "sm:max-lg:mr-[min(78vw,25rem)]" : ""}`} aria-label="Authorization model explorer">
        <div className="absolute inset-0" data-slot="explorer-scene">
          <ExplorerScene navigation={navigation} model={model} onInspect={(target) => command([{ type: "focus", target }])} />
        </div>
        <div className="pointer-events-none relative flex min-h-0 flex-1 flex-col overflow-y-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto">
          <header className="relative flex shrink-0 flex-wrap items-start justify-between gap-4 p-6 sm:px-8 lg:px-9">
            <div className="flex flex-col items-start gap-3">
              <h1 className="sr-only">Explore</h1>
              <Button
                ref={selectionButtonRef}
                variant="outline"
                size="sm"
                onClick={() => command([{ type: "overview" }])}
              >
                <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
                {view === "overview" ? "Overview" : "Back to overview"}
              </Button>
              <ToggleGroup
                className="rounded-lg border border-border p-1"
                variant="perspective"
                value={[navigation.perspective]}
                onValueChange={(value) => {
                  if (value[0] === "user" || value[0] === "resource") command([{ type: "perspective", perspective: value[0] }]);
                }}
                aria-label="Model perspective"
                spacing={0}
              >
                <ToggleGroupItem value="resource">Resource view</ToggleGroupItem>
                <ToggleGroupItem value="user">User view</ToggleGroupItem>
              </ToggleGroup>
              {view !== "overview" ? (
                <ToggleGroup className="rounded-lg border border-border p-1" variant="perspective"
                  value={[view]} onValueChange={(value) => {
                    if (value[0] === "focus" && navigation.focus) command([{ type: "focus", target: navigation.focus }]);
                    if (value[0] === "compare") compare();
                  }} aria-label="Resource exploration" spacing={0}>
                  <ToggleGroupItem value="focus">Access paths</ToggleGroupItem>
                  <ToggleGroupItem value="compare" disabled={!pattern?.scenarioIds.length}>Compare scenarios</ToggleGroupItem>
                </ToggleGroup>
              ) : null}
            </div>
            <div className="pointer-events-auto flex w-full min-w-0 max-w-96 flex-col items-start gap-4">
              <ExplorerControls
                controls={availableControls}
                values={defaultControls ? { "access-pattern": navigation.patternId, scenario: navigation.scenarioIds.length === 1 ? navigation.scenarioIds[0] : null } : controlValues}
                onValueChange={(id, value) => {
                  if (!defaultControls) { setControlValues((current) => ({ ...current, [id]: value })); return; }
                  if (id === "access-pattern" && value) command([{ type: "focus", target: { kind: "pattern", id: value } }]);
                  if (id === "scenario" && value && pattern) command([{ type: "compare", patternId: pattern.id, scenarioIds: [value] }]);
                }}
              />
            </div>
          </header>

          <div className="min-h-20 flex-1" />

          <div className="relative flex shrink-0 flex-col gap-5 px-5 pb-5 pt-4 sm:px-8">
            <div className="mx-auto w-full max-w-xl">
              <ExplorerQuestionInput />
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  Symbolic authorization model · no live access check
                </p>
              </div>
              <div className="flex items-center gap-0.5 rounded-lg border border-border p-1" aria-label="Future visualization controls">
                <Button variant="ghost" size="icon" aria-label="Orbit model" disabled><FocusIcon aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon" aria-label="Pan model" disabled><HandIcon aria-hidden="true" /></Button>
                <Separator orientation="vertical" className="mx-1 h-4" />
                <Button variant="ghost" size="icon" aria-label="Zoom in" disabled><PlusIcon aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon" aria-label="Zoom out" disabled><MinusIcon aria-hidden="true" /></Button>
                <Button variant="ghost" disabled>Fit view</Button>
              </div>
            </footer>
          </div>
        </div>
      </section>
      <SelectionInspector
        selection={selection}
        open={inspectorOpen}
        chat={<ExplorerChatAnswer />}
        details={<ExplorerModelDetails />}
        onOverview={() => {
          command([{ type: "overview" }]);
          selectionButtonRef.current?.focus();
        }}
        onClose={() => {
          command([{ type: "overview" }]);
          clearConversation();
          selectionButtonRef.current?.focus();
        }}
        returnFocusRef={selectionButtonRef}
      />
    </div>
  );
}
