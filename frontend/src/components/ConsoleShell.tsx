"use client";
import AppLayout from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useBreadcrumbItems } from "@/lib/breadcrumbs";
import { AWS_LOGO_LIGHT } from "@/lib/logo";
import { NAV_ITEMS } from "@/lib/navigation";
import { useNotifications } from "@/lib/notifications";
import { useDarkMode, useFollow } from "@/lib/ui";

function flatten(items: readonly { type: string; href?: string; items?: readonly any[] }[]): string[] {
  return items.flatMap((i) => (i.type === "link" && i.href ? [i.href] : i.items ? flatten(i.items) : []));
}
const NAV_HREFS = flatten(NAV_ITEMS as never);

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const follow = useFollow();
  const pathname = usePathname();
  const crumbs = useBreadcrumbItems();
  const { items } = useNotifications();
  const [navOpen, setNavOpen] = useState(true);
  const [dark, setDark] = useDarkMode();

  const activeHref = NAV_HREFS.filter((h) => pathname === h || pathname.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0] ?? "";

  return (
    <>
      <div id="h">
        <TopNavigation
          identity={{ href: "/hosted-zones", logo: { src: AWS_LOGO_LIGHT, alt: "AWS" }, onFollow: follow }}
          i18nStrings={{
            overflowMenuTriggerText: "More", overflowMenuTitleText: "All", overflowMenuBackIconAriaLabel: "Back",
            overflowMenuDismissIconAriaLabel: "Close menu",
          }}
          utilities={[
            { type: "button", text: "Route 53", href: "/hosted-zones", onFollow: follow },
            { type: "button", iconName: dark ? "star-filled" : "star", title: "Toggle dark mode", ariaLabel: "Toggle dark mode", onClick: () => setDark(!dark) },
            { type: "button", iconName: "notification", ariaLabel: "Notifications", disableUtilityCollapse: true },
            { type: "button", iconName: "status-info", ariaLabel: "Support" },
            { type: "button", text: "Global", iconName: "globe" as never },
            {
              type: "menu-dropdown", text: `${user?.username ?? ""} @ ${user?.account_id ?? ""}`, iconName: "user-profile",
              items: [
                { id: "acct", text: `Account ID: ${user?.account_id ?? ""}`, disabled: true },
                { id: "signout", text: "Sign out" },
              ],
              onItemClick: ({ detail }) => { if (detail.id === "signout") signOut(); },
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#h"
        navigationOpen={navOpen}
        onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        navigation={
          <SideNavigation
            header={{ text: "Route 53", href: "/dashboard" }}
            activeHref={activeHref}
            items={NAV_ITEMS}
            onFollow={follow}
          />
        }
        breadcrumbs={crumbs.length ? <BreadcrumbGroup items={crumbs} onFollow={follow} /> : undefined}
        notifications={items.length ? <Flashbar items={items} stackItems={false} /> : undefined}
        toolsHide
        content={children}
      />
    </>
  );
}
