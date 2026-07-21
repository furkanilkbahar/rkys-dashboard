"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { TenantModuleKey } from "@/lib/settings/modules";

import { LogoutMenuItem } from "./logout-menu-item";
import { SidebarNav } from "./sidebar-nav";

export function AdminShell({
  tenantLabel,
  role,
  enabledModules,
  children,
}: {
  tenantLabel: string;
  role: string;
  enabledModules: TenantModuleKey[];
  children: ReactNode;
}) {
  const t = useTranslations("admin");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="px-4 py-4 text-sm font-semibold">RKYS Dashboard</div>
        <SidebarNav enabledModules={enabledModules} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background px-4">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t("nav.menuOpen")}>
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="left" className="p-0">
              <SheetHeader className="px-4 py-4 text-left">
                <SheetTitle>RKYS Dashboard</SheetTitle>
              </SheetHeader>
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} enabledModules={enabledModules} />
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="ml-auto gap-2">
                  <span className="text-sm font-medium capitalize">{role}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal text-muted-foreground">{tenantLabel}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <LogoutMenuItem />
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
