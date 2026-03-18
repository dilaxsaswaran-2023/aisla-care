import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Bell, MessageCircle, Heart, LogOut, User, Phone, Users, ArrowLeft, ChevronRight, MessageSquare } from "lucide-react";
import BudiiChat from "@/components/patient/BudiiChat";
import ChatInterface from "@/components/chat/ChatInterface";
import VoiceCall from "@/components/communication/VoiceCall";
import SOSPopup from "@/components/patient/SOSPopup";
import { Badge } from "@/components/ui/badge";
import { formatTime, getTodayLocalDateString } from "@/lib/datetime";

interface Relationship {
  id: string;
  related_user_id: string;
  relationship_type: string;
  related_user_name: string;
}

interface ChatContact {
  id: string;
  name: string;
}

interface MedicationMonitorItem {
  schedule_id: string;
  medication_name: string;
  description?: string | null;
  urgency_level: "low" | "medium" | "high";
  time: string;
  scheduled_for_at: string;
  due_at: string;
  status: "pending" | "taken" | "missed";
  taken_at?: string | null;
  monitor_id?: string | null;
  can_mark_done: boolean;
}

const Patient = () => {
  const { user, signOut } = useAuth();
  const [showBudii, setShowBudii] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [chatContact, setChatContact] = useState<ChatContact | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [medicationItems, setMedicationItems] = useState<MedicationMonitorItem[]>([]);
  const [loadingMedication, setLoadingMedication] = useState(false);
  const [markingDoneKey, setMarkingDoneKey] = useState<string | null>(null);
  const { toast } = useToast();

  const loadRelationships = async () => {
    try {
      const data = await api.get('/relationships') as any[];
      if (data && data.length > 0) {
        const formatted: Relationship[] = [];

        for (const group of data) {
          // Extract caregiver
          if (group.caregiver?._id) {
            formatted.push({
              id: group.caregiver._id,
              related_user_id: group.caregiver._id,
              relationship_type: 'caregiver',
              related_user_name: group.caregiver.full_name || 'Caregiver',
            });
          }

          // Extract family members from patients array
          for (const patientGroup of group.patients || []) {
            for (const fm of patientGroup.family_members || []) {
              if (fm._id) {
                formatted.push({
                  id: fm._id,
                  related_user_id: fm._id,
                  relationship_type: fm.role || 'family',
                  related_user_name: fm.full_name || 'Family Member',
                });
              }
            }
          }
        }

        setRelationships(formatted);

        // Set caregiver from first caregiver relationship
        const cg = formatted.find(r => r.relationship_type === 'caregiver');
        if (cg) {
          setCaregiverId(cg.related_user_id);
          setChatContact({ id: cg.related_user_id, name: cg.related_user_name });
        }
      }
    } catch (error) {
      console.error('Error loading relationships:', error);
    }
  };

  const startGPSTracking = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        (position) => {
          api.post('/gps/patient/location', {
            patient_id: user?.id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            captured_at: new Date().toISOString(),
          }).catch(err => console.error('GPS save error:', err));
        },
        (error) => console.error('GPS error:', error),
        { enableHighAccuracy: true, maximumAge: 30000 }
      );
    }
  };

  const loadMedicationStatus = async () => {
    if (!user?.id) return;
    setLoadingMedication(true);
    try {
      const today = getTodayLocalDateString();
      const data = await api.get(`/medication-schedules/monitor?patient_id=${user.id}&date=${today}`) as {
        items?: MedicationMonitorItem[];
      };
      setMedicationItems(data?.items || []);
    } catch (error) {
      console.error("Error loading medication status:", error);
      setMedicationItems([]);
    } finally {
      setLoadingMedication(false);
    }
  };

  const markMedicationDone = async (item: MedicationMonitorItem) => {
    if (!item.can_mark_done) return;
    const key = `${item.schedule_id}-${item.time}`;
    setMarkingDoneKey(key);
    try {
      await api.post(`/medication-schedules/${item.schedule_id}/mark-taken`, {
        taken_at: new Date().toISOString(),
        scheduled_for_at: item.scheduled_for_at,
        notes: `Taken from patient app for ${item.time}`,
      });
      toast({
        title: "Medication marked as taken",
        description: `${item.medication_name} at ${item.time}`,
      });
      await loadMedicationStatus();
    } catch (error: any) {
      toast({
        title: "Failed to mark as done",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setMarkingDoneKey(null);
    }
  };

  useEffect(() => {
    if (user) { loadRelationships(); startGPSTracking(); loadMedicationStatus(); }
  }, [user]);

  const handleSOS = async () => {
    setIsSOSOpen(true);
  };

  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <Button variant="ghost" onClick={onClick} className="gap-2 mb-4 -ml-2">
      <ArrowLeft className="w-4 h-4" />Back
    </Button>
  );

  // Sub-views
  if (showCall && caregiverId) {
    return (
      <PatientShell onSignOut={signOut}>
        <BackButton onClick={() => setShowCall(false)} />
        <VoiceCall recipientId={caregiverId} recipientName="Your Caregiver" onClose={() => setShowCall(false)} />
      </PatientShell>
    );
  }

  if (showChat && chatContact) {
    return (
      <PatientShell onSignOut={signOut}>
        <BackButton onClick={() => setShowChat(false)} />
        <div className="h-[calc(100vh-180px)]">
          <ChatInterface recipientId={chatContact.id} recipientName={chatContact.name} />
        </div>
      </PatientShell>
    );
  }

  if (showBudii) {
    return (
      <PatientShell onSignOut={signOut}>
        <BudiiChat onClose={() => setShowBudii(false)} />
      </PatientShell>
    );
  }

  const actions = [
    { label: "Talk to Budii", desc: "Your friendly AI assistant", icon: MessageCircle, color: "bg-primary/10 text-primary", onClick: () => setShowBudii(true) },
    {
      label: "Chat with Caregiver",
      desc: chatContact ? `Message ${chatContact.name}` : "Send text messages",
      icon: User,
      color: "bg-success/10 text-success",
      onClick: () => {
        if (chatContact) setShowChat(true);
        else toast({ title: "No caregiver assigned", description: "You don't have a caregiver linked yet.", variant: "destructive" });
      }
    },
    { label: "Call Caregiver", desc: "Start a voice call", icon: Phone, color: "bg-primary/10 text-primary", onClick: () => setShowCall(true) },
  ];

  return (
    <>
      <PatientShell onSignOut={signOut}>
        <div className="space-y-6">
          {/* Welcome */}
          <div className="pt-2 pb-2">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome back 👋</h2>
            <p className="text-sm text-muted-foreground mt-1">How can we help you today?</p>
          </div>

          {/* SOS */}
          <Card className="care-card border-destructive/20 overflow-hidden">
            <CardContent className="p-6">
              <Button onClick={handleSOS} className="sos-button sos-pulse w-full h-28 text-xl font-bold gap-4" size="lg">
                <AlertCircle className="w-10 h-10" />
                SOS — NEED HELP
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-3">
                Press if you need immediate assistance
              </p>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="space-y-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="care-card w-full flex items-center gap-4 p-4 text-left hover:border-primary/20 transition-all"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${action.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </button>
              );
            })}
          </div>

          {/* Medications */}
          <Card className="care-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  Today's Medication Schedule
                </span>
                <Button variant="ghost" size="sm" onClick={loadMedicationStatus}>Refresh</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMedication ? (
                <p className="text-sm text-muted-foreground">Loading medication schedules...</p>
              ) : medicationItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No medication schedules for today.</p>
              ) : (
                <div className="space-y-2">
                  {medicationItems.map((item) => {
                    const key = `${item.schedule_id}-${item.time}`;
                    const isDone = item.status === "taken";
                    const isMissed = item.status === "missed";
                    const statusVariant = isDone ? "default" : isMissed ? "destructive" : "secondary";
                    const statusLabel = isDone ? "Taken" : isMissed ? "Missed" : "Pending";
                    const markingDone = markingDoneKey === key;
                    
                    return (
                      <div key={key} className="flex items-start justify-between gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{item.medication_name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium text-foreground">{item.time}</span>
                            <Badge variant={statusVariant as any} className="text-xs">
                              {statusLabel}
                            </Badge>
                            {item.urgency_level && (
                              <Badge
                                variant={item.urgency_level === 'high' ? 'destructive' : item.urgency_level === 'low' ? 'secondary' : 'default'}
                                className="text-xs"
                              >
                                {item.urgency_level.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          {item.taken_at && (
                            <p className="text-xs text-green-600 mt-1">
                              Taken at {formatTime(item.taken_at)}
                            </p>
                          )}
                        </div>
                        {isDone ? (
                          <Button size="sm" disabled>Done</Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => markMedicationDone(item)}
                            disabled={markingDone}
                          >
                            {markingDoneKey === key ? "Saving..." : "Done"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Care Team */}
          <Card className="care-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                My Care Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {relationships.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No care team members assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {relationships.map((rel) => (
                    <div key={rel.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{rel.related_user_name}</p>
                        <Badge variant={rel.relationship_type === 'caregiver' ? 'default' : 'secondary'} className="mt-1 text-[10px]">
                          {rel.relationship_type === 'caregiver' ? 'Caregiver' : 'Family'}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 shrink-0"
                        onClick={() => {
                          setChatContact({ id: rel.related_user_id, name: rel.related_user_name });
                          setShowChat(true);
                        }}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chat
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <div className="bg-accent/50 border border-primary/10 rounded-xl p-4 flex items-start gap-3">
            <Heart className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm text-foreground mb-1">You're Safe & Connected</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your caregiver can see your location and is always available to help.
              </p>
            </div>
          </div>
        </div>
      </PatientShell>
      <SOSPopup isOpen={isSOSOpen} onClose={() => setIsSOSOpen(false)} />
    </>
  );
};

// Shared patient page shell (simple top bar, no sidebar)
const PatientShell = ({ children, onSignOut }: { children: React.ReactNode; onSignOut: () => void }) => (
  <div className="min-h-screen bg-background">
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Heart className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground tracking-tight">AISLA</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
    <main className="max-w-2xl mx-auto px-4 py-6 gentle-fade-in">{children}</main>
  </div>
);

export default Patient;
