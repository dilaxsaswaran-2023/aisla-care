import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MapPin, AlertCircle, Calendar, Activity, RefreshCw, Users, MessageSquare
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
import { NotificationDropdown } from "@/components/caregiver/NotificationDropdown";
import { EmergencyBanner } from "@/components/caregiver/EmergencyBanner";
import { useFirebaseAlerts } from "@/hooks/useFirebaseAlerts";

interface Contact { id: string; name: string; }
interface FamilyContact { id: string; name: string; patientName: string; }
interface MessageContact {
  id: string;
  name: string;
  role?: string;
  patient_name?: string | null;
}
interface Conversation {
  partner_id: string;
  partner_name: string;
  unread_count: number;
  unread?: boolean;
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
  event_id?: string;
  created_at: string;
  source?: string; // 'normal' or 'budii'
  is_read?: boolean;
  is_added_to_emergency?: boolean;
}

const navItems = [
  { label: "Overview", value: "overview", icon: Activity },
  { label: "Patients", value: "patients", icon: Users },
  { label: "Messages", value: "messages", icon: MessageSquare },
  { label: "Location", value: "map", icon: MapPin },
  { label: "Tasks", value: "tasks", icon: Calendar },
  { label: "Alerts", value: "alerts", icon: AlertCircle },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const Caregiver = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("overview");
  const [patients, setPatients] = useState<Contact[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyContact[]>([]);
  const [messageContacts, setMessageContacts] = useState<MessageContact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [budiiAlerts, setBudiiAlerts] = useState<AlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [emergencyBannerVisible, setEmergencyBannerVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setActiveTab(params.get('tab') || 'overview');
  }, [location.search]);

  const handleTabChange = (tab: string) => navigate(`?tab=${tab}`, { replace: true });

  useEffect(() => {
    loadPatients();
    loadAlerts();
    loadContacts();
  }, [user]);

  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      // Fetch normal alerts
      const normalData = await api.get('/alerts/me') as AlertItem[];
      const normalAlerts = (normalData || []).map(a => ({ ...a, source: 'normal' }));
      setAlerts(normalAlerts);
      
      // Fetch budii alerts (serious ones)
      const budiiData = await api.get('/budii-alerts/me') as AlertItem[];
      const budiiAlertsWithSource = (budiiData || []).map(a => ({ ...a, source: 'budii' }));
      setBudiiAlerts(budiiAlertsWithSource);
    } catch {
      setAlerts([]);
      setBudiiAlerts([]);
    }
    setLoadingAlerts(false);
  };

  const loadPatients = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.get('/users/patients') as any;
      const pats: Contact[] = (data?.patients || []).map((p: any) => ({
        id: p.id || p._id,
        name: p.full_name,
      }));

      const fams: FamilyContact[] = (data?.familyMembers || []).map((f: any) => ({
        id: f.id || f._id,
        name: f.full_name,
        patientName: f.patient_name || '',
      }));

      setPatients(pats);
      setFamilyMembers(fams);
    } catch { /* non-critical */ }
    setLoading(false);
  };

  const loadContacts = async () => {
    if (!user) return;
    try {
      const data = await api.get('/users/contacts') as MessageContact[];
      setMessageContacts(data || []);
    } catch {
      setMessageContacts([]);
    }
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

  // ── Firebase real-time alerts ──
  const patientIds = useMemo(() => patients.map(p => p.id), [patients]);
  const { latestAlert, clearLatest } = useFirebaseAlerts(patientIds);

  useEffect(() => {
    if (!latestAlert) return;
    // Show emergency banner instead of sonner toast
    setEmergencyBannerVisible(true);
    loadAlerts();
  }, [latestAlert]);

  const handleMarkAllRead = async () => {
    try {
      await Promise.all([
        api.patch('/alerts/mark-read-all'),
        api.patch('/budii-alerts/mark-read-all'),
      ]);
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
      setBudiiAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    } catch { /* non-critical */ }
  };

  const handleAlertRead = (alertId: string, source: string) => {
    if (source === 'budii') {
      setBudiiAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    } else {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    }
  };

  const onRefresh = () => {
    loadAlerts();
    loadPatients();
    loadContacts();
    loadConversations();
  };

  // Filter Firebase alert for banner display (only SOS and geofence breach)
  const firebaseEmergencyAlert = useMemo(() => {
    if (!latestAlert) return null;
    // accept 'sos' and the geofence alert types
    const isEmergency = latestAlert.alert_type === 'sos' || latestAlert.alert_type === 'geofence' || latestAlert.alert_type === 'geofence_breach';
    if (!isEmergency) return null;
    // map Firebase alert shape to AlertItem shape expected by EmergencyBanner
    const la: any = latestAlert as any;
    return {
      id: la.id || String(Date.now()),
      alert_type: la.alert_type || 'sos',
      status: la.status || 'active',
      priority: la.priority || 'high',
      title: la.title || 'Emergency',
      message: la.message || '',
      voice_transcription: la.voice_transcription,
      patient_name: la.patient_name || '',
      created_at: la.created_at || new Date().toISOString(),
      source: 'firebase',
    } as any;
  }, [latestAlert]);

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
            className="gap-1.5 border border-border/60 bg-background/80 hover:bg-background"
          >
            <RefreshCw className="w-4 h-4" />
            {!isMobile && <span className="hidden sm:inline text-xs">Refresh</span>}
          </Button>
          <NotificationDropdown alerts={[...budiiAlerts, ...alerts]} isMobile={isMobile} onMarkAllRead={handleMarkAllRead} onAlertRead={handleAlertRead} />
        </div>
      }
    >
      {emergencyBannerVisible && firebaseEmergencyAlert && (
        <div className="mb-4 gentle-fade-in">
          <EmergencyBanner
            alert={firebaseEmergencyAlert}
            onClose={() => { setEmergencyBannerVisible(false); clearLatest(); }}
          />
        </div>
      )}
      {activeTab === "overview" && (
        <CaregiverOverview
          patients={patients}
          alerts={alerts}
          budiiAlerts={budiiAlerts}
          loading={loading}
          loadingAlerts={loadingAlerts}
          onTabChange={handleTabChange}
          onRefresh={onRefresh}
        />
      )}
      {activeTab === "patients" && <CaregiverPatients isMobile={isMobile} />}
      {activeTab === "messages" && (
        <CaregiverMessages
          contacts={messageContacts}
          conversations={conversations}
          loading={loading}
          onLoadConversations={loadConversations}
        />
      )}
      {activeTab === "map" && <CaregiverLocation />}
      {activeTab === "tasks" && <CaregiverTasks />}
      {activeTab === "alerts" && (
        <CaregiverAlerts
          alerts={[...budiiAlerts, ...alerts]}
          loadingAlerts={loadingAlerts}
          onRefresh={onRefresh}
        />
      )}
    </PortalLayout>
  );
};

export default Caregiver;
