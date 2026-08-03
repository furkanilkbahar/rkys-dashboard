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
import type { Mode } from "@/themes/mode";

import { LogoutMenuItem } from "./logout-menu-item";
import { ModeToggle } from "./mode-toggle";
import { SidebarNav } from "./sidebar-nav";

/**
 * Faz 21 (§2.3) — uygulama chrome'u.
 *
 * İki kolon: kompakt ikon+etiket sidebar + geniş ana içerik. SAĞ RAY YOK
 * (referansta vardı, alınmadı); bildirimler üst bardaki açılır panelde.
 *
 * Yükseklik GÖLGEYLE DEĞİL dolgu açıklığıyla anlatılır — panellerde gölge yok,
 * kenarlıklar çok soluk. Chrome tamamen nötr; renk yalnızca anlam taşıdığında
 * (durum rozeti, aktif nav, uyarı) görünür.
 *
 * Duyuru banner'ı artık `bg-amber-100` gibi sabit palet sınıfları kullanmıyor —
 * anlam token'ına (`--sem-warn`) bağlandı (RULES #13).
 */
export function AdminShell({
  tenantName,
  role,
  enabledModules,
  announcement,
  mode,
  children,
}: {
  tenantName: string;
  role: string;
  enabledModules: ModuleKey[];
  announcement?: ActiveAnnouncement | null;
  mode: Mode;
  children: ReactNode;
}) {
  const t = useTranslations("admin");
  const roleLabel = useTranslations("admin.staff.role")(role);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-bg)] text-[var(--surface-fg)] lg:flex-row">
      <aside className="hidden w-[194px] shrink-0 flex-col border-r border-[var(--surface-line)] bg-[var(--surface-sunken)] py-2.5 lg:flex">
        <div className="flex items-center gap-2 px-3.5 pt-1 pb-2.5 text-[12.5px] font-semibold">
          <span aria-hidden="true" className="size-[17px] shrink-0 rounded-[5px] bg-[var(--surface-accent)]" />
          RKYS Dashboard
        </div>
        <SidebarNav enabledModules={enabledModules} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[42px] items-center gap-2.5 border-b border-[var(--surface-line)] bg-[var(--surface-bg)] px-[var(--pad-panel)]">
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

          <span className="ml-auto" />
          <ModeToggle mode={mode} />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="text-[12.5px] font-medium">{tenantName}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal text-[var(--surface-fg-muted)]">
                  {roleLabel}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <LogoutMenuItem />
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {announcement && (
          <div
            data-slot="announcement-banner"
            className="border-b border-[var(--surface-line)] px-[var(--pad-panel)] py-2 text-[12.5px]"
            style={{
              backgroundColor: "color-mix(in oklch, var(--sem-warn) 14%, transparent)",
              color: "var(--surface-fg)",
            }}
          >
            <span className="font-medium">{announcement.title}</span>
            {" — "}
            <span className="text-[var(--surface-fg-muted)]">{announcement.body}</span>
          </div>
        )}

        <main className="flex-1 p-[var(--pad-panel)]">{children}</main>
      </div>
    </div>
  );
}
