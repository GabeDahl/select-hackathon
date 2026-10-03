import type { Metadata } from "next";
import { DatabaseIcon } from "lucide-react";

import { ScaffoldPage } from "@/components/scaffold-page";

export const metadata: Metadata = { title: "Schema" };

export default function SchemaPage() {
  return (
    <ScaffoldPage
      title="Schema"
      description="Inspect database evidence and choose the application objects to include in analysis."
      icon={DatabaseIcon}
      emptyTitle="No schema imported yet"
      emptyDescription="Tables, relationships, policies, grants, and functions will appear here after database introspection is connected."
      nextHref="/connections"
      nextLabel="Go to connections"
    />
  );
}
