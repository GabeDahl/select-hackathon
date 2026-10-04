"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxIcon, Settings2Icon } from "lucide-react";

import { AppNavigation } from "@/components/app-navigation";
import { ConnectionsDialog, ConnectionsTrigger } from "@/components/connections-dialog";
import { DatabaseConnectionStatus } from "@/components/database-connection-status";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isExplorer = pathname === "/";

  return (
    <TooltipProvider>
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-background p-3 text-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <header className="flex h-17 shrink-0 items-center gap-3 border-b px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xl" aria-label="AuthZcope home">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-highlight"><BoxIcon className="size-5" aria-hidden="true" /></span>
          <span>AuthZcope</span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-4">
          <ConnectionsTrigger variant="outline" aria-label="Open connections">
            <Settings2Icon data-icon="inline-start" aria-hidden="true" />
            Connections
            <span className="hidden sm:inline-flex"><DatabaseConnectionStatus showDatabaseLabel /></span>
          </ConnectionsTrigger>
        </div>
      </header>
      <SidebarProvider className="min-h-0 flex-1 overflow-hidden">
        <AppNavigation />
        <main id="main-content" tabIndex={-1} className={cn("min-h-0 min-w-0 flex-1 outline-none", isExplorer ? "overflow-hidden" : "overflow-y-auto")}>
          {isExplorer ? children : <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-12">{children}</div>}
        </main>
      </SidebarProvider>
      <ConnectionsDialog />
    </div>
    </TooltipProvider>
  );
}
