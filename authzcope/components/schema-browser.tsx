"use client";

import Link from "next/link";
import { DatabaseIcon } from "lucide-react";

import { useWorkspaceStore } from "@/components/database-connection-provider";
import { ConnectionsTrigger } from "@/components/connections-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import type { CatalogObject, DatabaseSnapshot, JsonObject, JsonValue } from "@/lib/catalog-types";
import { isObjectIncluded, selectVisibleObjects } from "@/lib/workspace-store";

function records(value: JsonValue | undefined): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => item !== null && typeof item === "object" && !Array.isArray(item))
    : [];
}
function text(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function SchemaBrowser() {
  const snapshot = useWorkspaceStore((s) => s.snapshot);
  const pending = useWorkspaceStore((s) => s.pending);
  const result = useWorkspaceStore((s) => s.result);
  const selectedId = useWorkspaceStore((s) => s.selectedObjectId);
  const filters = useWorkspaceStore((s) => s.schemaFilters);
  const overrides = useWorkspaceStore((s) => s.scopeOverrides);
  const select = useWorkspaceStore((s) => s.selectObject);
  const setFilters = useWorkspaceStore((s) => s.setSchemaFilters);
  const refresh = useWorkspaceStore((s) => s.testConnection);

  if (!snapshot) {
    return <Empty className="min-h-80 border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><DatabaseIcon aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>{pending ? "Importing schema…" : "No schema imported"}</EmptyTitle>
        {result && !result.ok ? <EmptyDescription>{result.message}</EmptyDescription> : null}
      </EmptyHeader>
      <EmptyContent><ConnectionsTrigger variant="outline">Connect database</ConnectionsTrigger></EmptyContent>
    </Empty>;
  }
  const visible = selectVisibleObjects(snapshot, filters, overrides);
  const selected = snapshot.objects.find((o) => o.id === selectedId);
  const includedCount = snapshot.objects.filter((o) => isObjectIncluded(o, overrides)).length;

  return <div className="flex flex-col gap-6">
    {result && !result.ok ? <Alert variant="destructive">
      <AlertTitle>Schema refresh failed</AlertTitle>
      <AlertDescription>{result.message} The previous snapshot is still shown.</AlertDescription>
    </Alert> : null}
    <Card>
      <CardHeader className="flex flex-col items-start gap-2">
        <CardTitle>Database evidence</CardTitle>
        <CardDescription>
          PostgreSQL {snapshot.serverVersion} · {snapshot.objects.length} objects · {includedCount} in scope
          {" · "}{new Date(snapshot.capturedAt).toLocaleString()}
        </CardDescription>
        <CardAction className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={() => void refresh()}>{pending ? "Refreshing…" : "Refresh schema"}</Button>
          <Link href="/analysis" className={buttonVariants({ variant: "default" })}>Analyze authorization</Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="schema-search" className="sr-only">Search database objects</FieldLabel>
            <Input id="schema-search" value={filters.search} placeholder="Search objects by name or comment" onChange={(e) => setFilters({ search: e.target.value })} />
          </Field>
        </FieldGroup>
        <Toggle className="mt-3" pressed={filters.showInfrastructure} onPressedChange={(showInfrastructure) => setFilters({ showInfrastructure })}>
          Show infrastructure candidates
        </Toggle>
      </CardContent>
    </Card>
    <Tabs value={filters.kind} onValueChange={(kind) => {
      if (kind === "relation" || kind === "routine" || kind === "policy" || kind === "all") setFilters({ kind });
    }}>
      <TabsList className="max-w-full flex-wrap group-data-horizontal/tabs:h-auto">
        <TabsTrigger className="h-7" value="relation">Tables & views</TabsTrigger>
        <TabsTrigger className="h-7" value="routine">Functions</TabsTrigger>
        <TabsTrigger className="h-7" value="policy">Policies</TabsTrigger>
        <TabsTrigger className="h-7" value="all">All evidence</TabsTrigger>
      </TabsList>
      <TabsContent value={filters.kind}>
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card className="min-w-0 self-start">
            <CardHeader><CardTitle>{visible.length} matching objects</CardTitle></CardHeader>
            <CardContent className="flex max-h-160 flex-col gap-1 overflow-y-auto">
              {visible.slice(0, 200).map((object) => <Button
                key={object.id} variant={object.id === selectedId ? "secondary" : "ghost"}
                className="h-auto min-w-0 justify-start whitespace-normal py-2 text-left"
                aria-pressed={object.id === selectedId} onClick={() => select(object.id)}
              ><span className="min-w-0 break-all">{object.identity}<span className="ml-2 text-xs text-muted-foreground">{object.kind}</span></span></Button>)}
              {!visible.length ? <p className="text-sm text-muted-foreground">No objects match these filters.</p> : null}
              {visible.length > 200 ? <p className="text-sm text-muted-foreground">First 200 matches. Narrow your search for more.</p> : null}
            </CardContent>
          </Card>
          {selected ? <ObjectDetails object={selected} snapshot={snapshot} /> : <p>Select an object.</p>}
        </div>
      </TabsContent>
    </Tabs>
    <Card>
      <CardHeader><CardTitle>Collection coverage</CardTitle><CardDescription>Snapshot {snapshot.revision.slice(0, 12)} · live access not evaluated</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">{snapshot.coverage.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        <p className="text-sm text-muted-foreground">System internals omitted: {snapshot.coverage.collectionOmissions.map((o) => o.identity).join(", ")}.</p>
      </CardContent>
    </Card>
  </div>;
}

function ObjectDetails({ object, snapshot }: { object: CatalogObject; snapshot: DatabaseSnapshot }) {
  const overrides = useWorkspaceStore((s) => s.scopeOverrides);
  const setIncluded = useWorkspaceStore((s) => s.setObjectIncluded);
  const select = useWorkspaceStore((s) => s.selectObject);
  const included = isObjectIncluded(object, overrides);
  const columns = records(object.details.columns);
  const grants = records(object.details.grants);
  const columnGrants = columns.flatMap((column) => records(column.grants).map((grant): JsonObject => ({ ...grant, column: column.name })));
  const attached = snapshot.objects.filter((o) => o.id !== object.id &&
    (o.details.relation === object.identity || o.details.domain === object.identity));
  const dependencies = snapshot.dependencies.filter((d) => d.fromId === object.id || d.toId === object.id);

  return <Card className="min-w-0 self-start">
    <CardHeader className="flex flex-col items-start gap-2">
      <CardTitle className="break-all">{object.identity}</CardTitle>
      <CardDescription>{object.comment ?? object.scopeReason}</CardDescription>
      <CardAction><Button variant="outline" onClick={() => setIncluded(object.id, !included)}>{included ? "Exclude from scope" : "Include in scope"}</Button></CardAction>
      <div className="flex flex-wrap gap-2"><Badge variant="secondary">{object.kind}</Badge><Badge variant={included ? "sage" : "outline"} title={object.scopeReason}>{included ? "Included" : "Excluded"}</Badge>
        {object.kind === "relation" ? <Badge variant="outline">{object.details.rlsEnabled ? "RLS enabled" : "RLS disabled"}</Badge> : null}</div>
    </CardHeader>
    <CardContent>
      <Tabs defaultValue="details" key={object.id}>
        <TabsList className="max-w-full flex-wrap group-data-horizontal/tabs:h-auto"><TabsTrigger className="h-7" value="details">Details</TabsTrigger><TabsTrigger className="h-7" value="sql">SQL</TabsTrigger><TabsTrigger className="h-7" value="dependencies">Dependencies</TabsTrigger><TabsTrigger className="h-7" value="metadata">Metadata</TabsTrigger></TabsList>
        <TabsContent value="details" className="flex flex-col gap-5">
          {columns.length ? <Table>
            <TableHeader><TableRow><TableHead>Column</TableHead><TableHead>Type</TableHead><TableHead>Nullable</TableHead><TableHead>Default / generation</TableHead></TableRow></TableHeader>
            <TableBody>{columns.map((column) => <TableRow key={text(column.name)}><TableCell>{text(column.name)}</TableCell><TableCell>{text(column.type)}</TableCell><TableCell>{column.nullable ? "Yes" : "No"}</TableCell><TableCell className="whitespace-normal break-all">{text(column.defaultExpression)}</TableCell></TableRow>)}</TableBody>
          </Table> : null}
          {grants.length ? <div><p className="mb-2 text-sm font-medium">Object grants</p><Table>
            <TableHeader><TableRow><TableHead>Grantee</TableHead><TableHead>Privilege</TableHead><TableHead>Grantable</TableHead></TableRow></TableHeader>
            <TableBody>{grants.map((grant, index) => <TableRow key={index}><TableCell>{text(grant.grantee)}</TableCell><TableCell>{text(grant.privilege)}</TableCell><TableCell>{grant.grantable ? "Yes" : "No"}</TableCell></TableRow>)}</TableBody>
          </Table></div> : null}
          {columnGrants.length ? <div><p className="mb-2 text-sm font-medium">Column grants</p><Table>
            <TableHeader><TableRow><TableHead>Column</TableHead><TableHead>Grantee</TableHead><TableHead>Privilege</TableHead><TableHead>Grantable</TableHead></TableRow></TableHeader>
            <TableBody>{columnGrants.map((grant, index) => <TableRow key={index}><TableCell>{text(grant.column)}</TableCell><TableCell>{text(grant.grantee)}</TableCell><TableCell>{text(grant.privilege)}</TableCell><TableCell>{grant.grantable ? "Yes" : "No"}</TableCell></TableRow>)}</TableBody>
          </Table></div> : null}
          {attached.length ? <div className="flex flex-col gap-1"><p className="text-sm font-medium">Attached evidence</p>{attached.map((o) => <Button key={o.id} variant="ghost" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => select(o.id)}>{o.name} · {o.kind}</Button>)}</div> : null}
          {!columns.length && !grants.length && !attached.length ? <p className="text-sm text-muted-foreground">See SQL or metadata.</p> : null}
        </TabsContent>
        <TabsContent value="sql"><pre className="max-h-160 overflow-auto rounded-md bg-muted p-4 text-xs">{object.definition ?? "No standalone SQL definition. See metadata or attached evidence."}</pre></TabsContent>
        <TabsContent value="metadata"><pre className="max-h-160 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(object.details, null, 2)}</pre></TabsContent>
        <TabsContent value="dependencies" className="flex flex-col gap-2">
          {dependencies.map((d, i) => {
            const outgoing = d.fromId === object.id;
            const targetId = outgoing ? d.toId : d.fromId;
            const identity = outgoing ? d.toIdentity : d.fromIdentity;
            const label = `${outgoing ? "References" : "Referenced by"}: ${identity}`;
            return <div key={i} className="flex flex-col gap-1">{targetId ? <Button variant="ghost" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => select(targetId)}>{label}</Button> : <p className="break-all text-sm">{label}</p>}<p className="text-xs text-muted-foreground">{d.source} · dependency type {d.dependencyType}{!targetId ? " · external definition not collected" : ""}</p></div>;
          })}
          {!dependencies.length ? <p className="text-sm text-muted-foreground">No catalog-recorded dependencies. Function body references may still exist.</p> : null}
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>;
}
