"use client";

import { ConnectionsTrigger } from "@/components/connections-dialog";
import { useAnalysisStore } from "@/components/analysis-provider";
import { AnalysisProgress } from "@/components/analysis-progress";
import { useAnalysisReadiness } from "@/hooks/use-analysis-readiness";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function ExplorerEmptyState() {
  const { ready } = useAnalysisReadiness();
  const pending = useAnalysisStore((state) => state.pending);
  const result = useAnalysisStore((state) => state.result);
  const analyze = useAnalysisStore((state) => state.analyze);
  const cancel = useAnalysisStore((state) => state.cancel);
  const error = result && !result.ok ? result : null;
  return <section className="dark model-space flex h-full min-h-0 flex-1 bg-background text-foreground" aria-label="Authorization model explorer">
    <h1 className="sr-only">Explore</h1>
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{pending ? <AnalysisProgress /> : error?.code === "cancelled" ? "Analysis cancelled" : error ? "Analysis failed" : "No authorization model"}</EmptyTitle>
        {error && !pending && error.code !== "cancelled" ? <EmptyDescription role="alert">{error.message}</EmptyDescription> : null}
      </EmptyHeader>
      <EmptyContent>
        {ready && !pending ? <Button type="button" onClick={() => void analyze()}>{error ? "Retry analysis" : "Analyze authorization"}</Button> : null}
        {pending ? <Button type="button" variant="outline" onClick={cancel}>Cancel analysis</Button> : null}
        <ConnectionsTrigger variant="outline" disabled={pending}>Connect</ConnectionsTrigger>
      </EmptyContent>
    </Empty>
  </section>;
}
