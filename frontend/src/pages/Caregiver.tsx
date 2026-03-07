import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MapPin, AlertCircle, Calendar, Activity, Phone, Bell,
  Heart, Users, MessageSquare, Camera
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
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [familyMembers, setFamilyMembers] = useState<Array<{ id: string; name: string; patientName: string }>>([]);
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string } | null>(null);
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

      if (data?.patients && data.patients.length > 0) {
        setPatients(data.patients);
        if (data.patients.length > 0 && !selectedContact) setSelectedContact(data.patients[0]);
      }

      if (data?.familyMembers) {
        setFamilyMembers(data.familyMembers);
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    }
    setLoading(false);
  };

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
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contacts</CardTitle>
              <CardDescription>Select someone to start chatting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading contacts...</p>
              ) : (
                <>
                  {patients.length > 0 && (
                    <div className="space-y-1.5">
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Patients</h3>
                      {patients.map((patient) => (
                        <Button key={patient.id} variant={selectedContact?.id === patient.id ? "default" : "ghost"} className="w-full justify-start gap-2 h-10" onClick={() => setSelectedContact(patient)}>
                          <Users className="w-4 h-4" />{patient.name}
                        </Button>
                      ))}
                    </div>
                  )}
                  {familyMembers.length > 0 && (
                    <div className="space-y-1.5">
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Family Members</h3>
                      {familyMembers.map((family) => (
                        <Button key={family.id} variant={selectedContact?.id === family.id ? "default" : "ghost"} className="w-full justify-start gap-2 h-10" onClick={() => setSelectedContact({ id: family.id, name: family.name })}>
                          <Heart className="w-4 h-4" />
                          <div className="flex flex-col items-start">
                            <span className="text-sm">{family.name}</span>
                            <span className="text-[10px] text-muted-foreground">Family of {family.patientName}</span>
                          </div>
                        </Button>
                      ))}
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{selectedContact ? `Chat with ${selectedContact.name}` : 'Select a Contact'}</CardTitle>
            </CardHeader>
            <CardContent className="h-[600px]">
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
