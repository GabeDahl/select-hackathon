"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { ConnectionForm } from "@/components/connection-form";
import { useAnalysisStore } from "@/components/analysis-provider";
import { useAnalysisReadiness } from "@/hooks/use-analysis-readiness";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Detached triggers share one dialog and restore focus to the opener.
const connectionsDialog = DialogPrimitive.createHandle();

export function ConnectionsTrigger({ children, ...props }: ComponentProps<typeof Button>) {
  return (
    <DialogTrigger handle={connectionsDialog} render={<Button {...props} />}>
      {children}
    </DialogTrigger>
  );
}

export function ConnectionsDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { ready, message } = useAnalysisReadiness();
  const model = useAnalysisStore((state) => state.model);
  const pending = useAnalysisStore((state) => state.pending);
  const analyze = useAnalysisStore((state) => state.analyze);

  function explore() {
    if (pending || (!model && !ready)) return;
    if (!model) void analyze();
    setOpen(false);
    router.push("/");
  }

  return (
    <Dialog handle={connectionsDialog} open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b p-5">
          <DialogTitle>Connections</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
          <ConnectionForm />
        </div>
        <DialogFooter className="m-0 shrink-0 items-center p-5">
          {message && !model ? <p className="mr-auto text-sm text-muted-foreground" role="status">{message}</p> : null}
          <Button type="button" disabled={pending || (!model && !ready)} onClick={explore}>
            {pending ? "Analyzing…" : model ? "Explore model" : "Analyze & explore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
