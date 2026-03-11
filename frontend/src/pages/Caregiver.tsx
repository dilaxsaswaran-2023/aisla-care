import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MapPin, AlertCircle, Calendar, Activity, Phone, Bell,
  Heart, Users, MessageSquare, Camera, RefreshCw, Clock,
  CheckCircle, XCircle, Cpu, BotMessageSquare, Construction
} from "lucide-react";
import PatientMap from "@/components/dashboard/PatientMap";
import TaskScheduler from "@/components/dashboard/TaskScheduler";
import { PatientManagement } from "@/components/caregiver/PatientManagement";
import ChatInterface from "@/components/chat/ChatInterface";
import PortalLayout from "@/components/layout/PortalLayout";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ALERT_TYPE_STYLE: Record<string, { border: string; bg: string; icon: string }> = {
  sos:        { border: "border-destructive", bg: "bg-destructive/5",  icon: "text-destructive" },
  fall:       { border: "border-destructive", bg: "bg-destructive/5",  icon: "text-destructive" },
  geofence:   { border: "border-warning",     bg: "bg-warning/5",      icon: "text-warning" },
  health:     { border: "border-warning",     bg: "bg-warning/5",      icon: "text-warning" },
  inactivity: { border: "border-muted",       bg: "bg-muted/30",       icon: "text-muted-foreground" },
};
function alertStyle(type: string) {
  return ALERT_TYPE_STYLE[type] ?? ALERT_TYPE_STYLE.inactivity;
}

// â”€â”€â”€ AlertCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AlertCard = ({ alert, detailed }: { alert: AlertItem; detailed?: boolean }) => {
  const s = alertStyle(alert.alert_type);
  return (
    <div className={`p-4 rounded-lg border-l-4 ${s.border} ${s.bg} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
            <AlertCircle className={`w-5 h-5 ${s.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="font-semibold text-sm">{alert.patient_name ?? "Patient"}</p>
              <Badge variant={alert.priority === "critical" || alert.priority === "high" ? "destructive" : "secondary"} className="text-[10px] h-4 px-1.5">
                {alert.alert_type.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{alert.title}</p>
            {alert.voice_transcription && (
              <p className="text-xs italic text-muted-foreground mt-1">
                "{alert.voice_transcription}"
              </p>
            )}
            {detailed && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(alert.created_at)}
              </p>
            )}
          </div>
        </div>
        {!detailed && (
          <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(alert.created_at)}</span>
        )}
      </div>
    </div>
  );
};

// â”€â”€â”€ Coming Soon panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ComingSoon = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
      <Construction className="w-7 h-7 text-muted-foreground" />
    </div>
    <div>
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground mt-1">This feature is coming soon. Stay tuned!</p>
    </div>
    <Badge variant="secondary">Coming Soon</Badge>
  </div>
);

// â”€â”€â”€ Notification Dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NotificationDropdown = ({ alerts }: { alerts: AlertItem[] }) => {
  const [open, setOpen] = useState(false);
  const unread = alerts.filter(a => a.status === "active").length;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 relative"
        onClick={() => setOpen(v => !v)}
      >
        <Bell className="w-4 h-4" />
        <span className="hidden sm:inline">Notifications</span>
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
                  const s = alertStyle(alert.alert_type);
                  return (
                    <div key={alert.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                      <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${s.bg}`}>
                        <AlertCircle className={`w-3.5 h-3.5 ${s.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{alert.patient_name ?? "Patient"} â€” {alert.title}</p>
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

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Caregiver = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [patients, setPatients] = useState<Contact[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
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
        if (pats.length > 0 && !selectedContact) setSelectedContact(pats[0]);
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
          <Button variant="ghost" size="icon" onClick={() => { loadAlerts(); loadPatients(); }} title="Refresh alerts">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <NotificationDropdown alerts={alerts} />
        </div>
      }
    >
      {/* â”€â”€ Overview â”€â”€ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Active Patients",
                value: loading ? "…" : patients.length,
                sub: patients.length === 0 ? "No patients assigned" : "All patients safe",
                icon: Users,
                color: "text-primary",
              },
              {
                label: "Active Alerts",
                value: loadingAlerts ? "…" : alerts.filter(a => a.status === "active").length,
                sub: alerts.filter(a => a.status === "active").length === 0 ? "No active alerts" : "Requires attention",
                icon: AlertCircle,
                color: alerts.filter(a => a.status === "active").length > 0 ? "text-destructive" : "text-success",
              },
              {
                label: "Budii Interactions",
                value: "--",
                sub: "Coming soon",
                icon: BotMessageSquare,
                color: "text-muted-foreground",
              },
              {
                label: "Connected Devices",
                value: "--",
                sub: "Coming soon",
                icon: Cpu,
                color: "text-muted-foreground",
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="care-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className={`stat-value ${stat.color}`}>{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </Card>
              );
            })}
          </div>

          {/* Recent Alerts + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="care-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Recent Alerts</CardTitle>
                    <CardDescription>Latest notifications from your patients</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { loadAlerts(); loadPatients(); }}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAlerts ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                    <CheckCircle className="w-8 h-8" />
                    <p className="text-sm">No alerts â€” all clear!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.slice(0, 5).map(a => <AlertCard key={a.id} alert={a} />)}
                    {alerts.length > 5 && (
                      <Button variant="ghost" className="w-full text-primary text-sm" onClick={() => handleTabChange("alerts")}>
                        View all {alerts.length} alerts
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Budii Interactions Coming Soon */}
            <Card className="care-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Budii Interactions</CardTitle>
                <CardDescription>AI companion conversation insights</CardDescription>
              </CardHeader>
              <CardContent>
                <ComingSoon label="Budii Interaction Insights" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* â”€â”€ Patients â”€â”€ */}
      {activeTab === "patients" && <PatientManagement />}

      {/* â”€â”€ Messages â”€â”€ */}
      {activeTab === "messages" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="care-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Contacts</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadConversations} title="Refresh">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
              <CardDescription>Select someone to start chatting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading contactsâ€¦</p>
              ) : (
                <>
                  {patients.length > 0 && (
                    <div className="space-y-1">
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Patients</h3>
                      {patients.map((patient) => {
                        const conv = conversations.find(c => c.partner_id === patient.id);
                        return (
                          <button key={patient.id} onClick={() => setSelectedContact(patient)}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedContact?.id === patient.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                            <Users className="w-4 h-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{patient.name}</p>
                              {conv?.last_message && (
                                <p className="text-xs opacity-60 truncate">
                                  {conv.last_message.message_type === 'audio' ? 'ðŸŽ™ Audio' : conv.last_message.content}
                                </p>
                              )}
                            </div>
                            {(conv?.unread_count ?? 0) > 0 && (
                              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs shrink-0">
                                {conv!.unread_count}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {familyMembers.length > 0 && (
                    <div className="space-y-1">
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Family Members</h3>
                      {familyMembers.map((family) => {
                        const conv = conversations.find(c => c.partner_id === family.id);
                        return (
                          <button key={family.id} onClick={() => setSelectedContact({ id: family.id, name: family.name })}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedContact?.id === family.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                            <Heart className="w-4 h-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{family.name}</p>
                              <p className="text-[10px] opacity-60 truncate">
                                {family.patientName ? `Family of ${family.patientName}` : 'Family Member'}
                              </p>
                            </div>
                            {(conv?.unread_count ?? 0) > 0 && (
                              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs shrink-0">
                                {conv!.unread_count}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {patients.length === 0 && familyMembers.length === 0 && (
                    <div className="text-center py-6">
                      <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No contacts available</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          <Card className="care-card lg:col-span-2">
            <CardContent className="h-[600px] p-0">
              {selectedContact ? (
                <ChatInterface recipientId={selectedContact.id} recipientName={selectedContact.name} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center space-y-2">
                    <MessageSquare className="w-10 h-10 mx-auto opacity-30" />
                    <p className="text-sm">Select a contact to start chatting</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* â”€â”€ Location â”€â”€ */}
      {activeTab === "map" && (
        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Patient Location Tracking</CardTitle>
            <CardDescription>Real-time GPS monitoring</CardDescription>
          </CardHeader>
          <CardContent className="p-0"><PatientMap /></CardContent>
        </Card>
      )}

      {/* â”€â”€ Tasks â”€â”€ */}
      {activeTab === "tasks" && (
        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Task & Reminder Scheduler</CardTitle>
            <CardDescription>Manage patient reminders and activities</CardDescription>
          </CardHeader>
          <CardContent><TaskScheduler /></CardContent>
        </Card>
      )}

      {/* â”€â”€ Alerts â”€â”€ */}
      {activeTab === "alerts" && (
        <Card className="care-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Alert Management</CardTitle>
                <CardDescription>Monitor and respond to patient alerts</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { loadAlerts(); loadPatients(); }}>
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <CheckCircle className="w-10 h-10 text-success" />
                <p className="font-medium text-foreground">No Alerts</p>
                <p className="text-sm">All your patients are safe and sound.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(a => <AlertCard key={a.id} alert={a} detailed />)}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PortalLayout>
  );
};

export default Caregiver;
