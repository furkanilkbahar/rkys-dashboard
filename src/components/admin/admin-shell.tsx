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
import type { ActiveAnnouncement } from "@/lib/data/announcements";
import type { ModuleKey } from "@/lib/modules/keys";

import { LogoutMenuItem } from "./logout-menu-item";
import { SidebarNav } from "./sidebar-nav";

export function AdminShell({
  tenantName,
  role,
  enabledModules,
  announcement,
  children,
}: {
  tenantName: string;
  role: string;
  enabledModules: ModuleKey[];
  announcement?: ActiveAnnouncement | null;
  children: ReactNode;
}) {
  const t = useTranslations("admin");
  const roleLabel = useTranslations("admin.staff.role")(role);
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
            <SheetContent side="left" className="p-0" closeLabel={t("nav.menuClose")}>
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
                  <span className="text-sm font-medium">{tenantName}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal text-muted-foreground">{roleLabel}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <LogoutMenuItem />
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {announcement && (
          <div
            data-slot="announcement-banner"
            className="border-b border-border bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          >
            <span className="font-medium">{announcement.title}</span>
            {" — "}
            <span>{announcement.body}</span>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
