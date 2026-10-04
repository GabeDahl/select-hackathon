"use client";

import { useSyncExternalStore, type RefObject, type ReactNode } from "react";
import { ArrowLeftIcon, FileTextIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

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

export function SelectionInspector({
  selection,
  onClose,
  onOverview,
  returnFocusRef,
  chat,
  details: suppliedDetails,
  open = false,
}: {
  selection: ExplorerSelection | null;
  onClose: () => void;
  onOverview?: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  chat?: ReactNode;
  details?: ReactNode;
  open?: boolean;
}) {
  const compact = useSyncExternalStore(subscribeToViewport, getCompactSnapshot, getServerSnapshot);

  if (!selection && !open) return null;

  const details = (
    <>
      {compact && selection && onOverview ? (
        <Button variant="outline" size="sm" className="mx-6 mt-5 self-start" onClick={onOverview}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          Back to overview
        </Button>
      ) : null}
      {chat}
      <header className="flex shrink-0 flex-col gap-5 px-6 pt-5 pb-7">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted"><FileTextIcon className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="selected-item-title" className="text-xl font-semibold tracking-tight">{selection?.label ?? "Access question"}</h2>
              {selection?.state ? <Badge variant="warm">{selection.state}</Badge> : null}
            </div>
            {selection?.location ? <p className="text-xs text-muted-foreground">{selection.location}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inspector">
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </header>
      {suppliedDetails}
    </>
  );

  if (compact) {
    return (
      <Sheet open modal={false} disablePointerDismissal onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="gap-0 overflow-y-auto overscroll-contain data-[side=right]:top-17 data-[side=right]:h-[calc(100dvh-4.25rem)] data-[side=right]:w-[min(78vw,25rem)] sm:max-w-none" showCloseButton={false} showOverlay={false} initialFocus={false} finalFocus={returnFocusRef}>
          <SheetTitle className="sr-only">{selection?.label ?? "Access question"} details</SheetTitle>
          <SheetDescription className="sr-only">Access explanation and evidence for the current selection or question.</SheetDescription>
          {details}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="hidden min-h-0 w-90 shrink-0 flex-col overflow-y-auto overscroll-contain border-l bg-background lg:flex xl:w-96"
      aria-labelledby="selected-item-title"
      data-selection-id={selection?.id}
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
