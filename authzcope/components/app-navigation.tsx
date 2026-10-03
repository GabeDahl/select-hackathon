"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { appNavigation } from "@/lib/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppNavigation() {
  const pathname = usePathname();

  function renderItem({ href, label, description, icon: Icon }: (typeof appNavigation)[number]) {
    const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <SidebarMenuItem key={href}>
        <SidebarMenuButton
          render={<Link href={href} />}
          size="rail"
          isActive={active}
          aria-current={active ? "page" : undefined}
          title={description}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar collapsible="none" className="w-20 shrink-0 border-r sm:w-22">
      <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col py-3">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {appNavigation.filter(({ href }) => href !== "/connections").map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>{appNavigation.filter(({ href }) => href === "/connections").map(renderItem)}</SidebarMenu>
        </SidebarFooter>
      </nav>
    </Sidebar>
  );
}
