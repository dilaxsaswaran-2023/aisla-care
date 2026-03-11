import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, LayoutDashboard, Shield, FileText, Link } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserManagement } from '@/components/admin/UserManagement';
import { RelationshipManagement } from '@/components/admin/RelationshipManagement';
import LiveMonitoring from '@/components/admin/LiveMonitoring';
import ConsentManagement from '@/components/admin/ConsentManagement';
import AuditLogsViewer from '@/components/admin/AuditLogsViewer';
import PortalLayout from '@/components/layout/PortalLayout';
import { api } from "@/lib/api";
import { useAuth } from '@/contexts/AuthContext';

interface Stats {
  total: number;
  admins: number;
  caregivers: number;
  patients: number;
  family: number;
  role: string;
  userId: string;
  corporate_id: string | null;
}

const navItems = [
  { label: "Overview", value: "overview", icon: LayoutDashboard },
  { label: "Users", value: "users", icon: Users },
  { label: "Relationships", value: "relationships", icon: Link },
  { label: "Monitoring", value: "monitoring", icon: Activity },
  { label: "Consent", value: "consent", icon: Shield },
  { label: "Audit Logs", value: "logs", icon: FileText },
];

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState("overview");
  const [stats, setStats] = React.useState<Stats>({ 
    total: 0,
    admins: 0, 
    caregivers: 0, 
    patients: 0, 
    family: 0,
    role: '',
    userId: '',
    corporate_id: null
  });

  // Sync active tab from URL query params
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab') || 'overview';
    setActiveTab(tabFromUrl);
  }, [location.search]);

  // Handle tab change and update URL
  const handleTabChange = (tab: string) => {
    navigate(`?tab=${tab}`, { replace: true });
  };

  React.useEffect(() => {
    const loadStats = async () => {
      try {
        if (user?.id) {
          const data = await api.get("/users/stats/me") as Stats;
          setStats(data as Stats);
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };
    loadStats();
  }, [user?.id]);

  const pageTitles: Record<string, { title: string; desc: string }> = {
    overview: { title: "Admin Overview", desc: "System health and user statistics" },
    users: { title: "User Management", desc: "Create, edit, and manage user accounts" },
    relationships: { title: "Relationships", desc: "Manage patient-caregiver-family associations" },
    monitoring: { title: "Monitoring", desc: "Camera feeds and GPS tracking" },
    consent: { title: "Consent Management", desc: "Privacy consent records and GDPR compliance" },
    logs: { title: "Audit Logs", desc: "System activity and compliance logs" },
  };

  const current = pageTitles[activeTab] || pageTitles.overview;

  return (
    <PortalLayout
      title="AISLA"
      subtitle="Admin"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      pageTitle={current.title}
      pageDescription={current.desc}
    >
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Caregivers", value: stats.caregivers, icon: Users, color: "text-primary", tab: "users" },
            { label: "Patients", value: stats.patients, icon: Users, color: "text-success", tab: "users" },
            { label: "Family Members", value: stats.family, icon: Users, color: "text-accent-foreground", tab: "users" },
            { label: "System Health", value: "Good", icon: Activity, color: "text-success", tab: "monitoring" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="care-card p-5 cursor-pointer hover:border-primary/30 transition-all"
                onClick={() => setActiveTab(stat.tab)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className={`stat-value ${stat.color}`}>{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">Click to view</p>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === "users" && <UserManagement />}
      {activeTab === "relationships" && <RelationshipManagement />}
      {activeTab === "monitoring" && <LiveMonitoring />}
      {activeTab === "consent" && <ConsentManagement />}
      {activeTab === "logs" && <AuditLogsViewer />}
    </PortalLayout>
  );
};

export default Admin;
