import type { Metadata } from "next";
import { BookOpenIcon } from "lucide-react";

import { ScaffoldPage } from "@/components/scaffold-page";

export const metadata: Metadata = { title: "Domain context" };

export default function ContextPage() {
  return (
    <ScaffoldPage
      title="Domain context"
      description="Give the analysis context about your application and its intended access rules."
      icon={BookOpenIcon}
      emptyTitle="Your application’s meaning belongs here"
      emptyDescription="Documentation, workflow descriptions, and intended permissions will help explain what the database rules mean. Context editing is not available yet."
      nextHref="/analysis"
      nextLabel="Explore analysis workspace"
    />
  );
}
