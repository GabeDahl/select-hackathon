import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { AnalysisWorkspace } from "@/components/analysis-workspace";

export const metadata: Metadata = { title: "Analysis" };
export const maxDuration = 180;

export default function AnalysisPage() {
  return (
    <section className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Analysis" />
      <AnalysisWorkspace />
    </section>
  );
}
