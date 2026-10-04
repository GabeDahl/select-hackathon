"use client";

import Link from "next/link";
import { LoaderCircleIcon } from "lucide-react";
import { useAnalysisStore } from "@/components/analysis-provider";
import { AnalysisProgress } from "@/components/analysis-progress";
import { useAiStore } from "@/components/ai-connection-provider";
import { useWorkspaceStore } from "@/components/database-connection-provider";
import { ConnectionsTrigger } from "@/components/connections-dialog";
import { useAnalysisReadiness } from "@/hooks/use-analysis-readiness";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuthorizationModel, Pattern } from "@/lib/authorization-model-types";

export function AnalysisWorkspace() {
  const snapshot = useWorkspaceStore((s) => s.snapshot);
  const overrides = useWorkspaceStore((s) => s.scopeOverrides);
  const input = useAiStore((s) => s.input);
  const model = useAnalysisStore((s) => s.model);
  const pending = useAnalysisStore((s) => s.pending);
  const result = useAnalysisStore((s) => s.result);
  const context = useAnalysisStore((s) => s.supportingContext);
  const updateContext = useAnalysisStore((s) => s.updateSupportingContext);
  const analyze = useAnalysisStore((s) => s.analyze);
  const cancel = useAnalysisStore((s) => s.cancel);
  const { ready, message: readinessMessage } = useAnalysisReadiness();
  const includedCount = snapshot?.objects.filter((object) => overrides[object.id] ?? object.defaultIncluded).length ?? 0;

  return <div className="flex min-w-0 flex-col gap-6">
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link className="underline underline-offset-4" href="/schema">{snapshot ? `${includedCount} objects in scope · ${snapshot.revision.slice(0, 12)}` : "Import a schema"}</Link>
          <ConnectionsTrigger variant="link" className="h-auto p-0">{input.aiModel.trim() ? `${input.aiProvider} · ${input.aiModel}` : "Configure an AI model"}</ConnectionsTrigger>
        </div>
        <Field>
          <FieldLabel htmlFor="analysis-context">Application context (optional)</FieldLabel>
          <Textarea id="analysis-context" className="min-h-32" value={context} maxLength={40_000}
            placeholder="Intended access rules or application documentation"
            onChange={(event) => updateContext(event.target.value)} />
          <FieldDescription>Cleared on reload.</FieldDescription>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!ready || pending} onClick={() => void analyze()}>
            {pending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : null}
            {pending ? "Analyzing…" : model ? "Analyze again" : "Analyze authorization"}
          </Button>
          {pending ? <Button type="button" variant="outline" onClick={cancel}>Cancel analysis</Button> : null}
          <p className="text-sm text-muted-foreground">SQL, metadata, and context are sent to your AI provider.</p>
        </div>
        {pending ? <p className="text-sm text-muted-foreground"><AnalysisProgress /></p> : null}
        {!ready ? <p className="text-sm text-muted-foreground">{readinessMessage}</p> : null}
      </CardContent>
    </Card>
    {result && !result.ok ? <Alert variant="destructive">
      <AlertTitle>{result.code === "cancelled" ? "Analysis cancelled" : "Analysis failed"}</AlertTitle>
      <AlertDescription>{result.message}
        {result.issues?.length ? <ul className="mt-2 list-disc pl-5">{result.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : null}
        {result.code === "stale_snapshot" ? <Link href="/schema" className="mt-2 underline underline-offset-4">Review and refresh schema</Link> : null}
      </AlertDescription>
    </Alert> : null}
    {model ? <ModelResults model={model} /> : null}
  </div>;
}

function ModelResults({ model }: { model: AuthorizationModel }) {
  const catalogObjectCount = useWorkspaceStore((s) => s.snapshot?.objects.length ?? 0);
  const selectedId = useAnalysisStore((s) => s.selectedPatternId);
  const selectPattern = useAnalysisStore((s) => s.selectPattern);
  const selected = model.accessPatterns.find((pattern) => pattern.id === selectedId);
  return <div className="flex min-w-0 flex-col gap-5">
    <Alert>
      <AlertTitle>Schema analysis · {model.materialization}</AlertTitle>
      <AlertDescription>{model.entityTypes.length} entity types · {model.relationshipTypes.length} relationships · {model.rules.length} rules · {model.accessPatterns.length} access patterns. Scenarios are symbolic; live access has not been evaluated.</AlertDescription>
    </Alert>
    <Tabs defaultValue="patterns">
      <TabsList><TabsTrigger value="patterns">Access patterns</TabsTrigger><TabsTrigger value="domain">Domain model</TabsTrigger><TabsTrigger value="contract">Structured output</TabsTrigger></TabsList>
      <TabsContent value="patterns">
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="min-w-0 self-start">
            <CardHeader><CardTitle>Access patterns</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {model.accessPatterns.map((pattern) => <Button key={pattern.id} variant={selectedId === pattern.id ? "secondary" : "ghost"}
                className="h-auto justify-between gap-3 whitespace-normal py-3 text-left" aria-pressed={selectedId === pattern.id} onClick={() => selectPattern(pattern.id)}>
                <span>{pattern.label}</span><Badge variant="outline">{pattern.classification}</Badge>
              </Button>)}
              {!model.accessPatterns.length ? <p className="text-sm text-muted-foreground">No supported access patterns. See missing inputs below.</p> : null}
            </CardContent>
          </Card>
          {selected ? <PatternDetails model={model} pattern={selected} /> : null}
        </div>
      </TabsContent>
      <TabsContent value="domain">
        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Entities & actions</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">
            {model.entityTypes.map((entity) => <div key={entity.id}><p className="font-medium">{entity.label}</p>
              <p className="text-sm text-muted-foreground">{entity.capabilities.join(", ")}</p>
              <p className="text-sm">{model.actions.filter((action) => action.targetEntityTypeId === entity.id).map((action) => action.label).join(" · ") || "No actions identified"}</p>
            </div>)}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Relationships & controls</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">
            {model.relationshipTypes.map((relationship) => <div key={relationship.id}><p className="font-medium">{relationship.label}</p>
              <p className="text-sm text-muted-foreground">{relationship.participants.map((participant) => `${participant.label}: ${model.entityTypes.find((entity) => entity.id === participant.entityTypeId)?.label}`).join(" · ")}</p>
            </div>)}
            <p className="text-sm text-muted-foreground">{model.facets.length} filters/perspectives · {model.scenarioControls.length} scenario controls</p>
          </CardContent></Card>
        </div>
      </TabsContent>
      <TabsContent value="contract">
        <Card className="min-w-0"><CardHeader><CardTitle>Authorization model</CardTitle><CardDescription>{model.modelId} · snapshot {model.snapshotRevision.slice(0, 12)}</CardDescription></CardHeader>
          <CardContent><pre className="max-h-160 overflow-auto rounded-lg bg-muted p-4 font-mono text-xs">{JSON.stringify(model, null, 2)}</pre></CardContent>
        </Card>
      </TabsContent>
    </Tabs>
    <Card>
      <CardHeader><CardTitle>Findings & coverage</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        {model.findings.map((finding) => <div key={finding.id}><p className="font-medium">{finding.label} <Badge variant="outline">{finding.kind.replaceAll("_", " ")}</Badge></p><p className="mt-1 text-sm text-muted-foreground">{finding.explanation}</p></div>)}
        {[...model.coverage.missingInputs, ...model.coverage.limits].map((limit, index) => <p key={index} className="text-sm text-muted-foreground">{limit}</p>)}
        <p className="text-sm text-muted-foreground">{model.coverage.analyzedObjectIds.length} analyzed objects · {model.coverage.externalDependencyIds.length} external dependencies retained · {Math.max(0, catalogObjectCount - model.coverage.analyzedObjectIds.length - model.coverage.externalDependencyIds.length)} omissions recorded in Evidence.</p>
      </CardContent>
    </Card>
  </div>;
}

function PatternDetails({ model, pattern }: { model: AuthorizationModel; pattern: Pattern }) {
  const selectSource = useWorkspaceStore((s) => s.selectObject);
  const claims = model.claims.filter((claim) => pattern.claimIds.includes(claim.id) ||
    model.rules.some((rule) => [...pattern.implementedRuleIds, ...pattern.intendedRuleIds].includes(rule.id) && rule.claimIds.includes(claim.id)));
  const paths = model.accessPaths.filter((path) => pattern.pathIds.includes(path.id));
  return <Card className="min-w-0 self-start">
    <CardHeader><CardTitle>{pattern.label}</CardTitle><CardDescription>{pattern.sidebarSummary}</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-5">
      <div className="flex gap-2"><Badge variant="outline">{pattern.classification}</Badge><Badge variant="outline">{pattern.completeness} coverage</Badge></div>
      {paths.length ? <div><p className="mb-2 text-sm font-medium">Alternative access paths</p><ul className="list-disc pl-5 text-sm text-muted-foreground">{paths.map((path) => <li key={path.id}>{path.label}</li>)}</ul></div> : null}
      {pattern.evaluations.length ? <div>
        <p className="mb-2 text-sm font-medium">Symbolic scenarios</p>
        <Table><TableHeader><TableRow><TableHead>Scenario</TableHead><TableHead>Implemented</TableHead><TableHead>Intended</TableHead></TableRow></TableHeader>
          <TableBody>{pattern.evaluations.map((evaluation) => <TableRow key={evaluation.id}>
            <TableCell className="whitespace-normal">{model.scenarios.find((scenario) => scenario.id === evaluation.scenarioId)?.label}</TableCell>
            <TableCell>{evaluation.implemented.outcome}<span className="block text-xs text-muted-foreground">{evaluation.implemented.method.replaceAll("_", " ")}</span></TableCell>
            <TableCell>{evaluation.intended?.outcome ?? "Unspecified"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">{model.scenarioSpaces.find((space) => space.id === pattern.scenarioSpaceId)?.boundary}</p>
      </div> : null}
      <div className="flex flex-col gap-3"><p className="text-sm font-medium">Claims & source evidence</p>
        {claims.map((claim) => <div key={claim.id} className="text-sm"><p>{claim.statement}</p><p className="mt-1 text-xs text-muted-foreground">{claim.basis} · {claim.support}</p>
          {claim.evidenceRefs.map((ref, index) => ref.sourceId === "context:application" ? <p key={index} className="mt-1 text-xs text-muted-foreground">Application context · {ref.pointer}</p>
            : <Link key={index} href="/schema" onClick={() => selectSource(ref.sourceId)} className={`${buttonVariants({ variant: "link", size: "sm" })} h-auto max-w-full justify-start whitespace-normal break-all px-0 text-xs`}>{ref.sourceId} · {ref.pointer}</Link>)}
        </div>)}
      </div>
    </CardContent>
  </Card>;
}
