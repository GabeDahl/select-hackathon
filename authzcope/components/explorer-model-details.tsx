"use client";

import Link from "next/link";
import { useAnalysisStore } from "@/components/analysis-provider";
import { useExplorerStore } from "@/components/explorer-navigation-provider";
import { useWorkspaceStore } from "@/components/database-connection-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function ExplorerModelDetails() {
  const model = useAnalysisStore((state) => state.model);
  const navigation = useExplorerStore((state) => state.navigation);
  const registry = useExplorerStore((state) => state.registry);
  const navigate = useExplorerStore((state) => state.navigate);
  const selectObject = useWorkspaceStore((state) => state.selectObject);
  if (!model) return null;
  const target = navigation.inspected ?? navigation.focus;
  const entry = registry.entries.find((entry) => entry.target.id === target?.id && entry.target.kind === target?.kind);
  const pattern = model.accessPatterns.find((pattern) => pattern.id === navigation.patternId);
  const selected = target ? registry.entries.find((item) => item.target.id === target.id && item.target.kind === target.kind) : null;
  const collections = { entity_type: model.entityTypes, relationship_type: model.relationshipTypes, action: model.actions, selector: model.selectors,
    variable: model.variables, condition: model.conditions, rule: model.rules, path: model.accessPaths, pattern: model.accessPatterns,
    scenario: model.scenarios, scenario_space: model.scenarioSpaces, group: model.presentation.groups };
  const item = target ? collections[target.kind].find((item) => item.id === target.id) : null;
  const claims = model.claims.filter((claim) => item?.claimIds.includes(claim.id));
  return <div className="flex flex-col gap-5 px-6 pb-6">
    <Badge variant="outline" className="w-fit">{model.materialization === "types" ? "Type model" : "Symbolic model"}</Badge>
    {!pattern && entry?.patternIds.length ? <div className="flex flex-col gap-2">
      {entry.patternIds.map((id) => <Button key={id} variant="outline" className="h-auto justify-start whitespace-normal text-left" onClick={() => navigate({ revision: registry.revision, commands: [{ type: "focus", target: { kind: "pattern", id } }] })}>
        {model.accessPatterns.find((pattern) => pattern.id === id)?.label}
      </Button>)}
    </div> : null}
    {pattern ? <>
      <p className="text-sm leading-relaxed">{pattern.sidebarSummary}</p>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">{pattern.classification}</Badge><Badge variant="outline">Coverage: {pattern.completeness}</Badge></div>
      <div className="flex flex-col gap-2" aria-label="Access paths">
        {pattern.pathIds.map((id) => <Button key={id} variant="outline" className="h-auto justify-start whitespace-normal text-left" onClick={() => navigate({ revision: registry.revision,
          commands: [{ type: "focus", target: { kind: "pattern", id: pattern.id } }, { type: "highlight", targets: [{ kind: "path", id }] }] })}>
          {model.accessPaths.find((path) => path.id === id)?.label}
        </Button>)}
      </div>
      {navigation.scenarioIds.map((id) => {
        const scenario = model.scenarios.find((scenario) => scenario.id === id);
        const evaluation = pattern.evaluations.find((evaluation) => evaluation.scenarioId === id);
        return <section key={id} className="flex flex-col gap-2 text-sm">
          <h3 className="font-medium">{scenario?.label}</h3>
          <span>Implemented: {evaluation?.implemented.outcome ?? "unknown"}</span>
          {evaluation?.intended ? <span>Intended: {evaluation.intended.outcome}</span> : null}
          <span className="text-xs text-muted-foreground">{evaluation?.implemented.method.replaceAll("_", " ") ?? "No evaluation supplied"}</span>
          {scenario?.facts.map((fact) => <span key={fact.variableId} className="text-xs">{model.variables.find((variable) => variable.id === fact.variableId)?.label}: {String(fact.value)} ({fact.basis})</span>)}
        </section>;
      })}
      {!navigation.scenarioIds.length ? <p className="text-xs text-muted-foreground">Select a scenario to inspect a symbolic outcome.</p> : null}
    </> : selected ? <p className="text-sm">{selected.label}</p> : null}
    {claims.length ? <><Separator /><ul className="flex flex-col gap-4" aria-label="Evidence-backed claims">
      {claims.map((claim) => <li key={claim.id} className="flex flex-col gap-2 text-sm">
        <Badge variant="outline" className="w-fit">{claim.basis.replaceAll("_", " ")} · {claim.support}</Badge>
        <p>{claim.statement}</p>
        {claim.evidenceRefs.map((ref) => <Link key={`${ref.sourceId}:${ref.pointer}`} href={ref.sourceId === "context:application" ? "/context" : "/schema"}
          onClick={() => { if (ref.sourceId !== "context:application") selectObject(ref.sourceId); }} className="break-all font-mono text-xs underline underline-offset-4">{ref.sourceId}{ref.pointer}</Link>)}
      </li>)}
    </ul></> : null}
  </div>;
}
