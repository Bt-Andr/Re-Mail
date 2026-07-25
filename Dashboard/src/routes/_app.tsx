import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppHeader } from "@/components/app/app-header";
import { RoleProvider } from "@/lib/role-context";
import { RouteTransitionBar } from "@/components/app/route-transition";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const key = useRouterState({ select: (s) => s.location.pathname });

  return (
    <RoleProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-background">
          <RouteTransitionBar />
          <AppHeader />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div key={key} className="animate-fade-in-up">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  );
}