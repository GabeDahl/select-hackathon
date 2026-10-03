import type { Metadata } from "next";
import { ScanSearchIcon } from "lucide-react";

import { ScaffoldPage } from "@/components/scaffold-page";

export const metadata: Metadata = { title: "Analysis" };

export default function AnalysisPage() {
  return (
    <ScaffoldPage
      title="Analysis"
      description="Understand who can do what, why access exists, and where behavior may differ from intent."
      icon={ScanSearchIcon}
      emptyTitle="No analysis yet"
      emptyDescription="Access explanations and their supporting evidence will appear here once schema inspection, domain context, and AI analysis are connected."
      nextHref="/context"
      nextLabel="Explore domain context"
    />
  );
}
