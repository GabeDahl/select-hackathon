"use client";

import Link from "next/link";
import { useSyncExternalStore, type RefObject } from "react";
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronRightIcon,
  FileCode2Icon,
  FileTextIcon,
  GitBranchIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Presentation-only selection metadata; this is not an AI analysis output schema.
export type ExplorerSelection = {
  id: string;
  label: string;
  kind: string;
  state: string;
  location: string;
};

const compactInspectorQuery = "(max-width: 1023px)";

function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(compactInspectorQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getCompactSnapshot() {
  return window.matchMedia(compactInspectorQuery).matches;
}

function getServerSnapshot() {
  return false;
}

function InspectorDetails() {
  return (
    <Tabs defaultValue="access" className="gap-6 px-6">
      <TabsList variant="line" className="w-full border-b pb-2" aria-label="Selected item details">
        <TabsTrigger value="access">Access</TabsTrigger>
        <TabsTrigger value="intent">Intent</TabsTrigger>
        <TabsTrigger value="evidence">Evidence</TabsTrigger>
      </TabsList>
      <TabsContent value="access">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-muted text-success-foreground"><CheckIcon className="size-4" aria-hidden="true" /></span>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold leading-snug">Maya can read this draft</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">Two independent access paths in this example.</p>
            </div>
          </div>
          <ol className="flex flex-col gap-3" aria-label="Example access paths">
            <li>
              <Card size="sm">
                <CardHeader className="grid-cols-[1.75rem_1fr] gap-x-3">
                  <span className="row-span-2 flex size-7 items-center justify-center rounded-full bg-muted font-mono text-[0.625rem]">01</span>
                  <CardTitle><h4>Project editor</h4></CardTitle>
                  <CardDescription>As an organization member and project editor, Maya can read drafts in this project.</CardDescription>
                </CardHeader>
              </Card>
            </li>
            <li>
              <Card size="sm">
                <CardHeader className="grid-cols-[1.75rem_1fr] gap-x-3">
                  <span className="row-span-2 flex size-7 items-center justify-center rounded-full bg-muted font-mono text-[0.625rem]">02</span>
                  <CardTitle><h4>Direct document share</h4></CardTitle>
                  <CardDescription>A viewer share grants Maya access to this document while she remains an organization member.</CardDescription>
                </CardHeader>
              </Card>
            </li>
          </ol>
          <Link href="/schema" className="flex w-fit items-center gap-1 text-xs underline underline-offset-4 hover:text-muted-foreground">
            Explore supporting evidence <ArrowUpRightIcon className="size-3" aria-hidden="true" />
          </Link>
          <Separator />
          <section className="flex flex-col items-start gap-4" aria-labelledby="scenario-heading">
            <div className="flex w-full items-center justify-between gap-2">
              <h3 id="scenario-heading" className="font-medium">If the share is revoked</h3>
              <Badge variant="secondary">Example</Badge>
            </div>
            <Alert variant="success" role="note" className="p-4">
              <CheckIcon aria-hidden="true" />
              <AlertTitle>Read access remains</AlertTitle>
              <AlertDescription>The project editor path still grants access.</AlertDescription>
            </Alert>
            <Button variant="outline" disabled title="Scenario comparison is not connected yet">
              <GitBranchIcon data-icon="inline-start" aria-hidden="true" />
              Compare paths
            </Button>
          </section>
          <Separator />
          <EvidenceLinks />
        </div>
      </TabsContent>
      <TabsContent value="intent">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">Intended access</h3>
            <Badge variant="warm">Example intent</Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">The example application treats project editing and document sharing as independent access paths.</p>
          <ul className="flex list-disc flex-col gap-3 pl-4 text-sm leading-relaxed">
            <li>Project editors can read and edit drafts within their project.</li>
            <li>A document share applies only to that document, including drafts.</li>
            <li>Both paths require continued organization membership.</li>
            <li>Authorship alone does not grant access.</li>
          </ul>
          <Separator />
          <p className="text-sm leading-relaxed text-muted-foreground">These are illustrative domain rules. Implementation evidence and test results have not been linked to this preview.</p>
          <Link href="/context" className="flex w-fit items-center gap-1 text-xs underline underline-offset-4 hover:text-muted-foreground">Open domain context <ArrowUpRightIcon className="size-3" aria-hidden="true" /></Link>
        </div>
      </TabsContent>
      <TabsContent value="evidence">
        <div className="flex flex-col gap-6">
          <h3 className="font-medium">Follow the explanation to its source</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">Policies, helper functions, application context, and tests will support each access path after analysis is connected.</p>
          <EvidenceLinks />
          <Separator />
          <Badge variant="outline">Evidence not linked</Badge>
          <p className="text-sm leading-relaxed text-muted-foreground">This selected item is a shell placeholder. No database permissions have been evaluated for it.</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function EvidenceLinks() {
  return (
    <section className="flex flex-col gap-3" aria-label="Evidence workspaces">
      <h3 className="font-medium">Evidence</h3>
      <Link href="/schema" className="flex items-center gap-3 rounded-lg border p-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"><FileCode2Icon className="size-4" aria-hidden="true" /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-xs font-medium">Database rules</strong><small className="text-[0.625rem] text-muted-foreground">Policies, functions, and access paths</small></span>
        <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
      <Link href="/context" className="flex items-center gap-3 rounded-lg border p-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"><BookOpenIcon className="size-4" aria-hidden="true" /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-xs font-medium">Domain context</strong><small className="text-[0.625rem] text-muted-foreground">Meaning and intended access</small></span>
        <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function SelectionInspector({
  selection,
  onClose,
  returnFocusRef,
}: {
  selection: ExplorerSelection | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const compact = useSyncExternalStore(subscribeToViewport, getCompactSnapshot, getServerSnapshot);

  if (!selection) return null;

  const details = (
    <>
      <header className="flex shrink-0 flex-col gap-5 px-6 pt-5 pb-7">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">Selected {selection.kind}</p>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inspector">
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted"><FileTextIcon className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="selected-item-title" className="text-xl font-semibold tracking-tight">{selection.label}</h2>
              <Badge variant="warm">{selection.state}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{selection.location}</p>
          </div>
        </div>
      </header>
      <InspectorDetails />
      <footer className="mt-auto flex items-center gap-2 px-6 pt-8 pb-6 text-[0.625rem] text-muted-foreground">
        <span className="size-1.5 shrink-0 rounded-full bg-highlight" aria-hidden="true" />
        Illustrative content · awaiting analysis
      </footer>
    </>
  );

  if (compact) {
    return (
      <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="gap-0 overflow-y-auto overscroll-contain data-[side=right]:w-[min(92vw,25rem)] sm:max-w-none" showCloseButton={false} finalFocus={returnFocusRef}>
          <SheetTitle className="sr-only">{selection.label} details</SheetTitle>
          <SheetDescription className="sr-only">Illustrative access, intent, and evidence for the selected item.</SheetDescription>
          {details}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="hidden min-h-0 w-90 shrink-0 flex-col overflow-y-auto overscroll-contain border-l bg-background lg:flex xl:w-96"
      aria-labelledby="selected-item-title"
      data-selection-id={selection.id}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
          returnFocusRef.current?.focus();
        }
      }}
    >
      {details}
    </aside>
  );
}
