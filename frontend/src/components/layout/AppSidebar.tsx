import { Heart, LogOut, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

interface NavItem {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AppSidebarProps {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const SidebarContent = ({
  title,
  subtitle,
  navItems,
  activeTab,
  onTabChange,
  collapsed,
  onItemClick,
}: {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  collapsed: boolean;
  onItemClick?: () => void;
}) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleNavClick = (value: string) => {
    onTabChange(value);
    onItemClick?.();
  };

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/8 flex-shrink-0">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 sidebar-logo-gradient">
          <Heart className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">{title}</h1>
            <p className="text-[10px] uppercase tracking-widest text-white/40 leading-tight mt-0.5">{subtitle}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="section-label text-white/30 px-3 mb-3">Navigation</p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              onClick={() => handleNavClick(item.value)}
              className={cn(
                "sidebar-item w-full",
                activeTab === item.value && "active"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span className="text-[13px]">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/8 space-y-0.5 flex-shrink-0">
        <button
          onClick={() => { navigate("/"); onItemClick?.(); }}
          className="sidebar-item w-full"
          title={collapsed ? "Home" : undefined}
        >
          <Home className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span className="text-[13px]">Home</span>}
        </button>
        <button
          onClick={() => signOut()}
          className="sidebar-item w-full text-red-400 hover:text-red-300"
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span className="text-[13px]">Sign Out</span>}
        </button>
      </div>
    </>
  );
};

const AppSidebar = ({
  title,
  subtitle,
  navItems,
  activeTab,
  onTabChange,
  isMobile = false,
  mobileOpen = false,
  onMobileOpenChange,
}: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  // Mobile: render as a Sheet (overlay drawer from the left)
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="sidebar w-[260px] p-0 flex flex-col border-r-0"
        >
          <VisuallyHidden.Root>
            <SheetTitle>Navigation Menu</SheetTitle>
          </VisuallyHidden.Root>
          <SidebarContent
            title={title}
            subtitle={subtitle}
            navItems={navItems}
            activeTab={activeTab}
            onTabChange={onTabChange}
            collapsed={false}
            onItemClick={() => onMobileOpenChange?.(false)}
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: fixed aside sidebar
  return (
    <aside className={cn(
      "sidebar fixed left-0 top-0 h-screen flex flex-col z-50 border-r border-border/10 transition-all duration-200",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      <SidebarContent
        title={title}
        subtitle={subtitle}
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={onTabChange}
        collapsed={collapsed}
      />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
    </aside>
  );
};

export default AppSidebar;
