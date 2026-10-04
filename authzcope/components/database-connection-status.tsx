"use client";

import { CheckCircle2Icon, CircleDashedIcon, CircleOffIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";

import { useDatabaseConnection } from "@/components/database-connection-provider";
import { Badge } from "@/components/ui/badge";

const statuses = {
  unconfigured: {
    label: "Not configured", variant: "outline", icon: CircleOffIcon,
    description: "Add a database connection URL.",
  },
  untested: {
    label: "Not tested", variant: "warm", icon: CircleDashedIcon,
    description: "Credentials available. Connection not tested.",
  },
  testing: {
    label: "Importing…", variant: "secondary", icon: LoaderCircleIcon,
    description: "Connecting and importing schema.",
  },
  verified: {
    label: "Verified", variant: "sage", icon: CheckCircle2Icon,
    description: "Last connection and import succeeded.",
  },
  failed: {
    label: "Test failed", variant: "destructive", icon: TriangleAlertIcon,
    description: "Connection failed. Review settings.",
  },
} as const;

export function DatabaseConnectionStatus({ showDatabaseLabel = false }: { showDatabaseLabel?: boolean }) {
  const { status } = useDatabaseConnection();
  const { label, variant, icon: Icon, description } = statuses[status];

  return (
    <span role="status" aria-live="polite" aria-atomic="true">
      <Badge variant={variant} title={description}>
        <Icon data-icon="inline-start" aria-hidden="true" />
        {showDatabaseLabel ? "DB: " : null}{label}
      </Badge>
    </span>
  );
}
