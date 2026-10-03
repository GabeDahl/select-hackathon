"use client";

import { useRef, useState } from "react";
import {
  ArrowUpIcon,
  BoxIcon,
  FileTextIcon,
  FocusIcon,
  HandIcon,
  LayersIcon,
  MinusIcon,
  MousePointer2Icon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";

import { SelectionInspector, type ExplorerSelection } from "@/components/selection-inspector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const previewSelection: ExplorerSelection = {
  id: "preview:launch-brief",
  label: "Launch brief",
  kind: "document",
  state: "Draft",
  location: "Product launch / Acme",
};

export function ExplorationWorkspace() {
  // Replace this placeholder with selection events from the future visualizer.
  const [selection, setSelection] = useState<ExplorerSelection | null>(previewSelection);
  const [perspective, setPerspective] = useState("resource");
  const selectionButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex h-full min-h-0 min-w-0">
      <section className="dark model-space relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background text-foreground" aria-label="Authorization model explorer">
        <div className="model-space-grid" aria-hidden="true" />
        <header className="relative flex shrink-0 flex-wrap items-start justify-between gap-4 p-6 sm:p-8 lg:p-9">
          <div>
            <p className="mb-2 text-[0.625rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">Authorization explorer</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Explore access</h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">Follow relationships. Understand permissions.</p>
            <ToggleGroup
              className="mt-6 rounded-lg border border-border p-1"
              variant="perspective"
              value={[perspective]}
              onValueChange={(value) => { if (value[0]) setPerspective(value[0]); }}
              aria-label="Model perspective"
              spacing={0}
            >
              <ToggleGroupItem value="resource">Resource view</ToggleGroupItem>
              <ToggleGroupItem value="user">User view</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Badge variant="outline"><LayersIcon data-icon="inline-start" aria-hidden="true" /> Shell preview</Badge>
        </header>

        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-8">
          <Empty className="flex-none p-0">
            <EmptyHeader>
              <EmptyMedia><div className="mb-3 flex size-20 items-center justify-center rounded-2xl border border-border bg-muted/30 text-highlight"><BoxIcon className="size-9" strokeWidth={1} aria-hidden="true" /></div></EmptyMedia>
              <EmptyTitle>{perspective === "resource" ? "Who can access this resource?" : "What can this person access?"}</EmptyTitle>
              <EmptyDescription>The 3D model will live here. Select an item to follow its relationships, understand access, and inspect the evidence.</EmptyDescription>
            </EmptyHeader>
          </Empty>
          <Button
            ref={selectionButtonRef}
            variant="selection"
            size="lg"
            className="mt-7 h-12 gap-3 px-5"
            onClick={() => setSelection(previewSelection)}
            aria-expanded={selection !== null}
            aria-label="Inspect Launch brief, example document"
          >
            <FileTextIcon data-icon="inline-start" aria-hidden="true" />
            Launch brief
            <Badge variant="warm">Draft</Badge>
            <MousePointer2Icon data-icon="inline-end" aria-hidden="true" />
          </Button>
          <p className="mt-4 text-center text-[0.625rem] text-muted-foreground">Example selection · interactive space coming next</p>
        </div>

        <div className="relative flex shrink-0 flex-col gap-7 px-5 pb-5 pt-6 sm:px-8 sm:pb-7">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><SparklesIcon className="size-3" aria-hidden="true" /><span>Navigate with a question</span><span className="ml-auto text-[0.625rem]">Coming soon</span></div>
            <InputGroup className="h-13 px-2">
              <InputGroupInput aria-label="Ask about access" placeholder="Why can Maya read this draft?" disabled />
              <InputGroupAddon><SparklesIcon aria-hidden="true" /></InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-sm" variant="secondary" disabled aria-label="Submit access question">
                  <ArrowUpIcon aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-[0.625rem] text-muted-foreground"><span className="size-1.5 rounded-full bg-highlight" aria-hidden="true" /> Visualization placeholder</p>
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
      </section>
      <SelectionInspector
        selection={selection}
        onClose={() => {
          setSelection(null);
          selectionButtonRef.current?.focus();
        }}
        returnFocusRef={selectionButtonRef}
      />
    </div>
  );
}
