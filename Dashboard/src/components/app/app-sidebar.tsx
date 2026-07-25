import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Users,
  Send,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  ScrollText,
  FileBarChart,
  Banknote,
  LifeBuoy,
  UserCog,
  KeyRound,
  Settings,
  Bell,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { canAccess, useRole } from "@/lib/role-context";

type Item = { title: string; url: string; icon: typeof LayoutDashboard; area: string };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Vue d'ensemble",
    items: [{ title: "Tableau de bord", url: "/", icon: LayoutDashboard, area: "overview" }],
  },
  {
    label: "Opérations",
    items: [
      { title: "Transactions", url: "/transactions", icon: ArrowLeftRight, area: "transactions" },
      { title: "Comptes", url: "/accounts", icon: Wallet, area: "accounts" },
      { title: "Clients", url: "/customers", icon: Users, area: "customers" },
      { title: "Virements", url: "/transfers", icon: Send, area: "transfers" },
      { title: "Cartes", url: "/cards", icon: CreditCard, area: "cards" },
    ],
  },
  {
    label: "Risque & Conformité",
    items: [
      { title: "Conformité KYC/AML", url: "/compliance", icon: ShieldCheck, area: "compliance" },
      { title: "Alertes & Fraude", url: "/risk", icon: AlertTriangle, area: "risk" },
      { title: "Journal d'audit", url: "/audit", icon: ScrollText, area: "audit" },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Rapports", url: "/reports", icon: FileBarChart, area: "reports" },
      { title: "Trésorerie", url: "/treasury", icon: Banknote, area: "treasury" },
    ],
  },
  {
    label: "Service client",
    items: [{ title: "Support", url: "/support", icon: LifeBuoy, area: "support" }],
  },
  {
    label: "Administration",
    items: [
      { title: "Utilisateurs", url: "/users", icon: UserCog, area: "users" },
      { title: "Rôles & permissions", url: "/roles", icon: KeyRound, area: "roles" },
      { title: "Paramètres", url: "/settings", icon: Settings, area: "settings" },
      { title: "Notifications", url: "/notifications", icon: Bell, area: "notifications" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useRole();

  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--navy)]">
            <Banknote className="h-4 w-4" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-sidebar-foreground">Northwind Bank</span>
              <span className="text-[11px] text-sidebar-foreground/60">Back-office · v2.4</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {GROUPS.map((group) => {
          const visible = group.items.filter((i) => canAccess(role, i.area));
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && (
                <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className="data-[active=true]:bg-[var(--brand)]/15 data-[active=true]:text-[var(--brand)] data-[active=true]:font-medium hover:bg-white/5"
                        >
                          <Link to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-3">
        {!collapsed ? (
          <div className="rounded-lg bg-white/5 p-3 text-xs text-sidebar-foreground/70">
            <div className="font-medium text-sidebar-foreground">Besoin d'aide ?</div>
            <div className="mt-0.5">Contactez la cellule support 24/7.</div>
          </div>
        ) : (
          <div className="flex justify-center text-sidebar-foreground/60">
            <LifeBuoy className="h-4 w-4" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}