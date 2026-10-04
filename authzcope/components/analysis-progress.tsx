"use client";

import { useEffect, useState } from "react";
import { useAnalysisStore } from "@/components/analysis-provider";
import type { AnalysisPhase } from "@/lib/analysis-types";

const labels: Record<AnalysisPhase, string> = {
  starting: "Starting analysis…",
  checking_schema: "Checking database schema…",
  preparing_evidence: "Preparing evidence…",
  generating_model: "Waiting for authorization model…",
  receiving_model: "Receiving authorization model…",
  validating_model: "Validating authorization model…",
};

export function AnalysisProgress() {
  const phase = useAnalysisStore((state) => state.phase);
  const startedAt = useAnalysisStore((state) => state.startedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [startedAt]);
  if (!phase || startedAt === null) return null;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1_000));
  return <span><span role="status">{labels[phase]}</span> <span aria-hidden="true">· {elapsed}s</span></span>;
}
