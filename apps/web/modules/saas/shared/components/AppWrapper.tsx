"use client";

import { cn } from "@repo/ui";
import { NavBar } from "@saas/shared/components/NavBar";
import { type PropsWithChildren } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, useSidebar } from "../lib/sidebar-context";

function AppContent({ children }: PropsWithChildren) {
  const { isCollapsed } = useSidebar();
  const pathname = usePathname();

  return (
    <div className="bg-background">
      <NavBar />
      <div
        className={cn("flex transition-[margin] duration-300 ease-in-out", {
          "min-h-[calc(100vh)] md:ml-[260px]": !isCollapsed,
          "min-h-[calc(100vh)] md:ml-[64px]": isCollapsed,
        })}
      >
        <main className="py-6 bg-[#F8F9FA] px-4 md:p-8 min-h-full w-full border-t md:border-t-0">
          <div key={pathname} className="container px-0 h-full page-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AppWrapper({ children }: PropsWithChildren) {
  return (
    <SidebarProvider>
      <AppContent>{children}</AppContent>
    </SidebarProvider>
  );
}
