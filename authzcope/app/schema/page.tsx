import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SchemaBrowser } from "@/components/schema-browser";

export const metadata: Metadata = { title: "Evidence" };

export default function SchemaPage() {
  return (
    <>
      <PageHeader title="Evidence" />
      <SchemaBrowser />
    </>
  );
}
