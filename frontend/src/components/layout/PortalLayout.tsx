import { useState } from "react";
import { Menu, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import AppSidebar from "./AppSidebar";

interface NavItem {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PortalLayoutProps {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  pageTitle: string;
  pageDescription?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

const PortalLayout = ({
  title,
  subtitle,
  navItems,
  activeTab,
  onTabChange,
  pageTitle,
  pageDescription,
  headerActions,
  children,
}: PortalLayoutProps) => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        title={title}
        subtitle={subtitle}
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={onTabChange}
        isMobile={isMobile}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
      />

      {/* Main content area */}
      <div className={isMobile ? "transition-all duration-200" : "ml-[240px] transition-all duration-200"}>
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 md:px-8 h-14 md:h-16">
            <div className="flex items-center gap-3">
              {/* Hamburger button — mobile only */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 -ml-1"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              )}

              {/* Logo — mobile only (appears beside hamburger) */}
              {isMobile && (
                <div className="flex items-center gap-2 mr-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 sidebar-logo-gradient">
                    <Heart className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-foreground tracking-tight">AISLA</span>
                </div>
              )}

              {/* Separator on mobile */}
              {isMobile && (
                <div className="w-px h-5 bg-border mx-1" />
              )}

              <div className="min-w-0">
                <h1 className="text-sm md:text-lg font-bold text-foreground tracking-tight leading-tight truncate">{pageTitle}</h1>
                {pageDescription && !isMobile && (
                  <p className="text-xs text-muted-foreground mt-0.5">{pageDescription}</p>
                )}
              </div>
            </div>
            {headerActions && <div className="flex items-center gap-2 shrink-0">{headerActions}</div>}
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6 lg:p-8 max-w-[1440px]">
          <div className="gentle-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default PortalLayout;
