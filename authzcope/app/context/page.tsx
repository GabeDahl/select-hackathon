import type { Metadata } from "next";
import { BookOpenIcon } from "lucide-react";

import { ScaffoldPage } from "@/components/scaffold-page";

export const metadata: Metadata = { title: "Domain context" };

export default function ContextPage() {
  return (
    <ScaffoldPage
      title="Domain context"
      icon={BookOpenIcon}
      emptyTitle="Context is managed in Analysis"
      nextHref="/analysis"
      nextLabel="Open analysis"
    />
  );
}
