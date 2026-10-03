"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxIcon, CableIcon, ChevronRightIcon } from "lucide-react";

import { AppNavigation } from "@/components/app-navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isExplorer = pathname === "/";
  const currentPage = appNavigation.find(({ href }) => href === pathname);

  return (
    <TooltipProvider>
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-background p-3 text-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <header className="flex h-17 shrink-0 items-center gap-6 border-b px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xl" aria-label="Authzcope home">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-highlight"><BoxIcon className="size-5" aria-hidden="true" /></span>
          <span>Authzcope</span>
        </Link>
        <div className="hidden min-w-0 items-center gap-3 text-sm lg:flex">
          <span className="mr-2 h-6 w-px bg-border" aria-hidden="true" />
          <span className="hidden text-muted-foreground xl:inline">Authorization model</span>
          <ChevronRightIcon className="hidden size-3 text-muted-foreground xl:block" aria-hidden="true" />
          <span>{currentPage?.label ?? "Workspace"}</span>
          <Badge variant={isExplorer ? "sage" : "secondary"}>
            {isExplorer ? "Demo model" : "Preview"}
          </Badge>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-4">
          <Link href="/schema" className="hidden rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:inline">Evidence</Link>
          <Link href="/connections" aria-label="Connect database" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            <CableIcon data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">Connect database</span>
          </Link>
          <span className="hidden size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground md:flex" title="Development preview" aria-label="Development preview">A</span>
        </div>
      </header>
      <SidebarProvider className="min-h-0 flex-1 overflow-hidden">
        <AppNavigation />
        <main id="main-content" tabIndex={-1} className={cn("min-h-0 min-w-0 flex-1 outline-none", isExplorer ? "overflow-hidden" : "overflow-y-auto")}>
          {isExplorer ? children : <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-12">{children}</div>}
        </main>
      </SidebarProvider>
    </div>
    </TooltipProvider>
  );
}
