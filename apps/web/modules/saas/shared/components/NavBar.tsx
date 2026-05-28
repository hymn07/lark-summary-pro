"use client";

import { cn, Logo } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { NotificationBell } from "@saas/shared/components/NotificationBell";
import { UserMenu } from "@saas/shared/components/UserMenu";
import {
  FileTextIcon,
  SettingsIcon,
  ShieldIcon,
  PanelLeftCloseIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useSidebar } from "../lib/sidebar-context";

export function NavBar() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const useSidebarLayout = true;

  type MenuItem = {
    label: string;
    icon: LucideIcon;
    href: string;
    isActive: boolean;
    adminOnly?: boolean;
  };

  const menuItems: MenuItem[] = [
    {
      label: "会议记录",
      href: "/app/meetings",
      icon: VideoIcon,
      isActive: pathname.startsWith("/app/meetings"),
    },
    {
      label: "会议纪要",
      href: "/app",
      icon: FileTextIcon,
      isActive: pathname === "/app",
    },
    {
      label: "设置",
      href: "/app/settings",
      icon: SettingsIcon,
      isActive: pathname.startsWith("/app/settings") && !pathname.includes("admin"),
    },
    {
      label: "管理后台",
      href: "/app/admin",
      icon: ShieldIcon,
      isActive: pathname.startsWith("/app/admin"),
      adminOnly: true,
    },
  ];

  return (
    <nav
      className={cn("w-full", {
        "w-full md:fixed md:top-0 md:left-0 md:h-full md:z-20 md:transition-[width] md:duration-300 md:ease-in-out md:w-[260px]":
          useSidebarLayout,
        "md:w-[64px]": useSidebarLayout && isCollapsed,
      })}
    >
      <div
        className={cn("py-4 px-4", {
          "py-0 px-3 md:flex md:h-full md:flex-col md:pb-0": useSidebarLayout,
        })}
      >
        {/* Logo */}
        <div className={cn("flex items-center justify-between", { "md:h-[56px]": useSidebarLayout })}>
          {!isCollapsed && (
            <>
              <Link href="/app" className="block -ml-1">
                <Logo withLabel={true} />
              </Link>
              <Button variant="ghost" size="icon" onClick={toggleCollapsed} className="size-7 text-muted-foreground">
                <PanelLeftCloseIcon className="size-4" />
              </Button>
            </>
          )}
          {isCollapsed && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={toggleCollapsed} className="flex w-full items-center justify-center rounded-md py-1">
                    <Logo withLabel={false} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">展开</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Mobile user menu */}
        <div className={cn("mr-0 ml-auto flex items-center justify-end gap-4", { "md:hidden": useSidebarLayout })}>
          <UserMenu />
        </div>

        {/* Navigation menu */}
        <TooltipProvider delayDuration={0}>
          <ul className={cn(
            "no-scrollbar mt-4 flex list-none items-center justify-start gap-2 overflow-x-auto text-sm",
            { "md:mx-0 md:mt-4 md:mb-0 md:flex md:flex-col md:items-stretch md:gap-0.5 md:px-0": useSidebarLayout,
              "md:items-center": useSidebarLayout && isCollapsed,
            },
          )}>
            {menuItems.map((item) => {
              const itemClass = cn(
                "flex items-center transition-colors",
                item.isActive ? "font-semibold bg-primary/8 text-primary" : "hover:bg-muted/50 text-muted-foreground",
              );
              const iconClass = cn("shrink-0 size-4", item.isActive ? "text-primary" : "opacity-60");

              if (isCollapsed) {
                return (
                  <li key={item.href} className="flex justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={item.href} className={cn(itemClass, "size-9 justify-center rounded-lg")} prefetch>
                          <item.icon className={iconClass} />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link href={item.href} className={cn(itemClass, "group w-full whitespace-nowrap rounded-lg px-3 py-2")} prefetch>
                    <span className="flex w-full items-center gap-3">
                      <item.icon className={iconClass} />
                      <span className="flex-1 truncate">{item.label}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </TooltipProvider>

        {/* Bottom: user */}
        <div className={cn("relative mt-auto mb-0 hidden flex-col pb-4 pt-2", { "md:flex": useSidebarLayout })}>
          {isCollapsed ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex w-full justify-center py-1">
                    <UserMenu showUserName={false} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">账户</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <UserMenu showUserName={true} />
          )}
        </div>
      </div>
    </nav>
  );
}
