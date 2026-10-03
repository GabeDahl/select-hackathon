import type { Metadata } from "next";
import { ConnectionForm } from "@/components/connection-form";
import { PageHeader } from "@/components/page-header";
import { getConfigurationStatus } from "@/lib/introspection";

export const metadata: Metadata = { title: "Connections" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ConnectionsPage() {
  return (
    <>
      <PageHeader
        title="Connections"
        description="Choose the database and AI model for your authorization analysis."
      />
      <ConnectionForm configuration={getConfigurationStatus()} />
    </>
  );
}
