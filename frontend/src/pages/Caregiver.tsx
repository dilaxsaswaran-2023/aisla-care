import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MapPin, AlertCircle, Calendar, Activity, Bell, RefreshCw, Users, MessageSquare, CheckCircle
} from "lucide-react";
import PortalLayout from "@/components/layout/PortalLayout";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { CaregiverOverview } from "@/components/caregiver/CaregiverOverview";
import { CaregiverPatients } from "@/components/caregiver/CaregiverPatients";
import { CaregiverMessages } from "@/components/caregiver/CaregiverMessages";
import { CaregiverLocation } from "@/components/caregiver/CaregiverLocation";
import { CaregiverTasks } from "@/components/caregiver/CaregiverTasks";
import { CaregiverAlerts } from "@/components/caregiver/CaregiverAlerts";

interface Contact { id: string; name: string; }
interface FamilyContact { id: string; name: string; patientName: string; }
interface Conversation {
  partner_id: string;
  partner_name: string;
  unread_count: number;
  last_message?: { content: string; message_type: string; created_at: string };
}
interface AlertItem {
  id: string;
  alert_type: string;
  status: string;
  priority: string;
  title: string;
  message: string;
  voice_transcription?: string;
  patient_name?: string;
  created_at: string;
}

const navItems = [
  { label: "Overview", value: "overview", icon: Activity },
  { label: "Patients", value: "patients", icon: Users },
  { label: "Messages", value: "messages", icon: MessageSquare },
  { label: "Location", value: "map", icon: MapPin },
  { label: "Tasks", value: "tasks", icon: Calendar },
  { label: "Alerts", value: "alerts", icon: AlertCircle },
];

// ─── Notification Dropdown ────────────────────────────────────────────────────
const NotificationDropdown = ({ alerts, isMobile }: { alerts: AlertItem[]; isMobile: boolean }) => {
  const [open, setOpen] = useState(false);
  const unread = alerts.filter(a => a.status === "active").length;

  const formatRelativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getAlertStyle = (type: string) => {
    const styles: Record<string, { bg: string; icon: string }> = {
      sos:        { bg: "bg-destructive/5",  icon: "text-destructive" },
      fall:       { bg: "bg-destructive/5",  icon: "text-destructive" },
      geofence:   { bg: "bg-warning/5",      icon: "text-warning" },
      health:     { bg: "bg-warning/5",      icon: "text-warning" },
      inactivity: { bg: "bg-muted/30",       icon: "text-muted-foreground" },
    };
    return styles[type] ?? styles.inactivity;
  };

  return (
    <div className="relative">
      <Button
        variant={isMobile ? "ghost" : "outline"}
        size= {isMobile ? "icon" : "default"}
        className="relative gap-1.5"
        onClick={() => setOpen(v => !v)}
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {!isMobile && <span className="hidden sm:inline text-xs">Notifications</span>}
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{unread} Active</Badge>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <CheckCircle className="w-7 h-7" />
                  <p className="text-sm">All clear!</p>
                </div>
              ) : (
                alerts.slice(0, 8).map(alert => {
                  const s = getAlertStyle(alert.alert_type);
                  return (
                    <div key={alert.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                      <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${s.bg}`}>
                        <AlertCircle className={`w-3.5 h-3.5 ${s.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{alert.patient_name ?? "Patient"} — {alert.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatRelativeTime(alert.created_at)}</p>
                      </div>
                      {alert.status === "active" && (
                        <div className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Caregiver = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("overview");
  const [patients, setPatients] = useState<Contact[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyContact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setActiveTab(params.get('tab') || 'overview');
  }, [location.search]);

  const handleTabChange = (tab: string) => navigate(`?tab=${tab}`, { replace: true });

  useEffect(() => { loadPatients(); loadAlerts(); }, [user]);

  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const data = await api.get('/alerts/me') as AlertItem[];
      setAlerts(data || []);
    } catch {
      setAlerts([]);
    }
    setLoadingAlerts(false);
  };

  const loadPatients = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.get('/users/patients') as any;
      if (data?.patients) {
        const pats: Contact[] = data.patients.map((p: any) => ({ id: p.id || p._id, name: p.full_name }));
        setPatients(pats);
      }
      if (data?.familyMembers) {
        setFamilyMembers(data.familyMembers.map((f: any) => ({
          id: f.id || f._id, name: f.full_name, patientName: f.patient_name || '',
        })));
      }
    } catch { /* non-critical */ }
    setLoading(false);
  };

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.get('/messages/conversations') as Conversation[];
      setConversations(data || []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    if (activeTab === 'messages') loadConversations();
  }, [activeTab, loadConversations]);

  const onRefresh = () => { loadAlerts(); loadPatients(); };

  const pageTitles: Record<string, { title: string; desc: string }> = {
    overview: { title: "Overview", desc: "Real-time snapshot of your care operations" },
    patients: { title: "Patients", desc: "Manage and monitor assigned patients" },
    messages: { title: "Messages", desc: "Communicate with patients and families" },
    map: { title: "Location Tracking", desc: "GPS monitoring of patient locations" },
    tasks: { title: "Tasks & Reminders", desc: "Schedule and manage patient activities" },
    alerts: { title: "Alerts", desc: "Monitor and respond to patient alerts" },
  };
  const current = pageTitles[activeTab] ?? pageTitles.overview;

  return (
    <PortalLayout
      title="AISLA"
      subtitle="Caregiver"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      pageTitle={current.title}
      pageDescription={current.desc}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size={isMobile ? "icon" : "default"}
            onClick={onRefresh}
            title="Refresh"
            className="gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            {!isMobile && <span className="hidden sm:inline text-xs">Refresh</span>}
          </Button>
          <NotificationDropdown alerts={alerts} isMobile={isMobile} />
        </div>
      }
    >
      {activeTab === "overview" && (
        <CaregiverOverview
          patients={patients}
          alerts={alerts}
          loading={loading}
          loadingAlerts={loadingAlerts}
          onTabChange={handleTabChange}
          onRefresh={onRefresh}
        />
      )}
      {activeTab === "patients" && <CaregiverPatients isMobile={isMobile} />}
      {activeTab === "messages" && (
        <CaregiverMessages
          patients={patients}
          familyMembers={familyMembers}
          loading={loading}
          onLoadConversations={loadConversations}
        />
      )}
      {activeTab === "map" && <CaregiverLocation />}
      {activeTab === "tasks" && <CaregiverTasks />}
      {activeTab === "alerts" && (
        <CaregiverAlerts
          alerts={alerts}
          loadingAlerts={loadingAlerts}
          onRefresh={onRefresh}
        />
      )}
    </PortalLayout>
  );
};

export default Caregiver;
