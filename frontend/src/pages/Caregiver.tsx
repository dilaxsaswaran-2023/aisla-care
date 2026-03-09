import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MapPin, AlertCircle, Calendar, Activity, Phone, Bell,
  Heart, Users, MessageSquare, Camera, RefreshCw
} from "lucide-react";
import PatientMap from "@/components/dashboard/PatientMap";
import AlertsPanel from "@/components/dashboard/AlertsPanel";
import TaskScheduler from "@/components/dashboard/TaskScheduler";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { PatientManagement } from "@/components/caregiver/PatientManagement";
import DeviceManager from "@/components/devices/DeviceManager";
import CameraFeed from "@/components/devices/CameraFeed";
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

const navItems = [
  { label: "Overview", value: "overview", icon: Activity },
  { label: "Patients", value: "patients", icon: Users },
  { label: "Messages", value: "messages", icon: MessageSquare },
  { label: "Devices", value: "devices", icon: Camera },
  { label: "Location", value: "map", icon: MapPin },
  { label: "Tasks", value: "tasks", icon: Calendar },
  { label: "Alerts", value: "alerts", icon: AlertCircle },
];

const Caregiver = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [patients, setPatients] = useState<Contact[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync active tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab') || 'overview';
    setActiveTab(tabFromUrl);
  }, [location.search]);

  // Handle tab change and update URL
  const handleTabChange = (tab: string) => {
    navigate(`?tab=${tab}`, { replace: true });
  };

  useEffect(() => { loadPatients(); }, [user]);

  const loadPatients = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.get('/users/patients') as any;

      if (data?.patients) {
        const pats: Contact[] = data.patients.map((p: any) => ({
          id: p.id || p._id,
          name: p.full_name,
        }));
        setPatients(pats);
        if (pats.length > 0 && !selectedContact) setSelectedContact(pats[0]);
      }

      if (data?.familyMembers) {
        setFamilyMembers(data.familyMembers.map((f: any) => ({
          id: f.id || f._id,
          name: f.full_name,
          patientName: f.patient_name || '',
        })));
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    }
    setLoading(false);
  };

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.get('/messages/conversations') as Conversation[];
      setConversations(data || []);
    } catch {
      // non-critical
    }
  }, []);

  // Load conversations whenever messages tab becomes active
  useEffect(() => {
    if (activeTab === 'messages') loadConversations();
  }, [activeTab, loadConversations]);

  const pageTitles: Record<string, { title: string; desc: string }> = {
    overview: { title: "Overview", desc: "Real-time snapshot of your care operations" },
    patients: { title: "Patients", desc: "Manage and monitor assigned patients" },
    messages: { title: "Messages", desc: "Communicate with patients and families" },
    devices: { title: "Devices", desc: "Camera feeds and IoT device monitoring" },
    map: { title: "Location Tracking", desc: "GPS monitoring of patient locations" },
    tasks: { title: "Tasks & Reminders", desc: "Schedule and manage patient activities" },
    alerts: { title: "Alerts", desc: "Monitor and respond to patient alerts" },
  };

  const current = pageTitles[activeTab] || pageTitles.overview;

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
          <Button variant="outline" size="sm" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </Button>
        </div>
      }
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Active Patients", value: patients.length, sub: patients.length === 0 ? 'No patients assigned' : 'All patients safe', icon: Users, color: "text-primary" },
              { label: "Active Alerts", value: 1, sub: "Requires attention", icon: AlertCircle, color: "text-warning" },
              { label: "Budii Interactions", value: 12, sub: "Today", icon: MessageSquare, color: "text-success" },
              { label: "Connected Devices", value: 8, sub: "All active", icon: Camera, color: "text-primary" },
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="care-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Alerts</CardTitle>
                <CardDescription>Latest notifications from your patients</CardDescription>
              </CardHeader>
              <CardContent><AlertsPanel /></CardContent>
            </Card>
            <Card className="care-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Activity Timeline</CardTitle>
                <CardDescription>Recent patient activities and updates</CardDescription>
              </CardHeader>
              <CardContent><ActivityFeed /></CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "patients" && <PatientManagement />}

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
                <p className="text-sm text-muted-foreground">Loading contacts...</p>
              ) : (
                <>
                  {patients.length > 0 && (
                    <div className="space-y-1">
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Patients</h3>
                      {patients.map((patient) => {
                        const conv = conversations.find(c => c.partner_id === patient.id);
                        return (
                          <button
                            key={patient.id}
                            onClick={() => setSelectedContact(patient)}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              selectedContact?.id === patient.id
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <Users className="w-4 h-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{patient.name}</p>
                              {conv?.last_message && (
                                <p className="text-xs opacity-60 truncate">
                                  {conv.last_message.message_type === 'audio' ? '🎙 Audio' : conv.last_message.content}
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
                          <button
                            key={family.id}
                            onClick={() => setSelectedContact({ id: family.id, name: family.name })}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              selectedContact?.id === family.id
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
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
                  {/* Conversations with unknown contacts (from other senders) */}
                  {conversations
                    .filter(c => !patients.find(p => p.id === c.partner_id) && !familyMembers.find(f => f.id === c.partner_id))
                    .length > 0 && (
                    <div className="space-y-1">
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Other Conversations</h3>
                      {conversations
                        .filter(c => !patients.find(p => p.id === c.partner_id) && !familyMembers.find(f => f.id === c.partner_id))
                        .map((conv) => (
                          <button
                            key={conv.partner_id}
                            onClick={() => setSelectedContact({ id: conv.partner_id, name: conv.partner_name })}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              selectedContact?.id === conv.partner_id
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <MessageSquare className="w-4 h-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{conv.partner_name}</p>
                              {conv.last_message && (
                                <p className="text-xs opacity-60 truncate">
                                  {conv.last_message.message_type === 'audio' ? '🎙 Audio' : conv.last_message.content}
                                </p>
                              )}
                            </div>
                            {conv.unread_count > 0 && (
                              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs shrink-0">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                  {patients.length === 0 && familyMembers.length === 0 && conversations.length === 0 && (
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

      {activeTab === "devices" && (
        <div className="space-y-6">
          <Card className="care-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live Camera Feeds</CardTitle>
              <CardDescription>Real-time monitoring with people detection</CardDescription>
            </CardHeader>
            <CardContent><CameraFeed /></CardContent>
          </Card>
          <DeviceManager />
        </div>
      )}

      {activeTab === "map" && (
        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Patient Location Tracking</CardTitle>
            <CardDescription>Real-time GPS monitoring</CardDescription>
          </CardHeader>
          <CardContent className="p-0"><PatientMap /></CardContent>
        </Card>
      )}

      {activeTab === "tasks" && (
        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Task & Reminder Scheduler</CardTitle>
            <CardDescription>Manage patient reminders and activities</CardDescription>
          </CardHeader>
          <CardContent><TaskScheduler /></CardContent>
        </Card>
      )}

      {activeTab === "alerts" && (
        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Alert Management</CardTitle>
            <CardDescription>Monitor and respond to patient alerts</CardDescription>
          </CardHeader>
          <CardContent><AlertsPanel detailed /></CardContent>
        </Card>
      )}
    </PortalLayout>
  );
};

export default Caregiver;
