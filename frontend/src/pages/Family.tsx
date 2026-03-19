import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import PortalLayout from "@/components/layout/PortalLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import FamilyStatus from "@/components/family/FamilyStatus";
import FamilyLocation from "@/components/family/FamilyLocation";
import { CaregiverMessages } from "@/components/caregiver/CaregiverMessages";
import { FamilyAlertBanner } from "@/components/family/FamilyAlertBanner";
import { Activity, MapPin, MessageSquare } from "lucide-react";
import { useFirebaseAlerts } from "@/hooks/useFirebaseAlerts";

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity?: string;
  priority?: string;
  status: string;
  created_at: string;
}

interface PatientItem {
  id: string;
  name: string;
  caregiver_id?: string | null;
  phone_country?: string | null;
  phone_number?: string | null;
  address?: string | null;
  geofence_state?: string | null;
  is_geofencing?: boolean;
  updated_at?: string | null;
}

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

const navItems = [
  { label: "Status", value: "status", icon: Activity },
  { label: "Location", value: "location", icon: MapPin },
  { label: "Messages", value: "messages", icon: MessageSquare },
];

const Family = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("status");
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [caregiver, setCaregiver] = useState<{ id: string; name: string } | null>(null);
  const [messageContacts, setMessageContacts] = useState<MessageContact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertBannerVisible, setAlertBannerVisible] = useState(true);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? patients[0] ?? null,
    [patients, selectedPatientId]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setActiveTab(params.get("tab") || "status");
  }, [location.search]);

  useEffect(() => {
    if (!user) return;
    loadPatientData();
    loadAlerts();
    loadContacts();
  }, [user]);

  useEffect(() => {
    if (activeTab === "messages") {
      loadConversations();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedPatient && selectedPatient.id !== selectedPatientId) {
      setSelectedPatientId(selectedPatient.id);
    }
  }, [selectedPatient, selectedPatientId]);

  // Firebase real-time alerts for linked patients
  const patientIds = useMemo(() => patients.map((p) => p.id), [patients]);
  const { latestAlert, clearLatest } = useFirebaseAlerts(patientIds);

  useEffect(() => {
    if (!latestAlert) return;
    setAlertBannerVisible(true);
    loadAlerts();
  }, [latestAlert]);

  // Filter Firebase alert for banner display (only SOS and geofence breach)
  const familyAlertBanner = useMemo(() => {
    if (!latestAlert) return null;
    const type = String(latestAlert.alert_type || "").toLowerCase();
    const title = String((latestAlert as any).title || "").toLowerCase();
    const source = String((latestAlert as any).source || "").toLowerCase();
    const isEmergency =
      source === "budii" ||
      type.includes("sos") ||
      type.includes("geofence") ||
      title.includes("sos") ||
      title.includes("geofence");
    if (!isEmergency) return null;
    const la: any = latestAlert as any;
    return {
      id: la.id || String(Date.now()),
      alert_type: la.alert_type || "sos",
      status: la.status || "active",
      priority: la.priority || "high",
      title: la.title || "Alert",
      message: la.message || "",
      voice_transcription: la.voice_transcription,
      patient_name: la.patient_name || "",
      created_at: la.created_at || new Date().toISOString(),
      source: "firebase",
    } as any;
  }, [latestAlert]);

  const loadPatientData = async () => {
    setLoading(true);
    try {
      const response = await api.get("/users/patients") as any;
      const rawPatients = Array.isArray(response)
        ? response
        : Array.isArray(response?.patients)
          ? response.patients
          : [];

      const mapped: PatientItem[] = rawPatients.map((p: any) => ({
        id: p.id || p._id,
        name: p.full_name || "Patient",
        caregiver_id: p.caregiver_id || null,
        phone_country: p.phone_country || null,
        phone_number: p.phone_number || null,
        address: p.address || null,
        geofence_state: p.geofence_state || null,
        is_geofencing: !!p.is_geofencing,
        updated_at: p.updated_at || null,
      })).filter((p: PatientItem) => !!p.id);

      setPatients(mapped);
      if (mapped.length > 0 && !selectedPatientId) {
        setSelectedPatientId(mapped[0].id);
      }

      const caregivers = Array.isArray(response?.caregivers) ? response.caregivers : [];
      if (caregivers.length > 0) {
        const first = caregivers[0];
        const firstId = first.id || first._id;
        try {
          const convs = await api.get("/messages/conversations") as any[];
          const match = (convs || []).find((c) => c.partner_id === firstId);
          if (match) {
            setCaregiver({ id: match.partner_id, name: match.partner_name || "Caregiver" });
          } else {
            setCaregiver({ id: firstId, name: first.full_name || "Caregiver" });
          }
        } catch {
          setCaregiver({ id: firstId, name: first.full_name || "Caregiver" });
        }
      } else {
        setCaregiver(null);
      }
    } catch {
      setPatients([]);
      setCaregiver(null);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const data = (await api.get("/alerts/me")) as AlertItem[];
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    }
  };

  const loadContacts = async () => {
    setLoadingMessages(true);
    try {
      const data = (await api.get("/users/contacts")) as MessageContact[];
      setMessageContacts(data || []);
    } catch {
      setMessageContacts([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadConversations = async () => {
    try {
      const data = (await api.get("/messages/conversations")) as Conversation[];
      setConversations(data || []);
    } catch {
      setConversations([]);
    }
  };

  const handleTabChange = (tab: string) => {
    navigate(`?tab=${tab}`, { replace: true });
  };

  const pageTitles: Record<string, { title: string; desc: string }> = {
    status: {
      title: "Patient Status",
      desc: selectedPatient ? `${selectedPatient.name} - Live family dashboard` : "No linked patients",
    },
    location: {
      title: "Location",
      desc: selectedPatient ? `Tracking ${selectedPatient.name}` : "No linked patients",
    },
    messages: {
      title: "Messages",
      desc: caregiver ? `Chat with ${caregiver.name}` : "Updates from the care team",
    },
  };
  const current = pageTitles[activeTab] || pageTitles.status;

  return (
    <PortalLayout
      title="AISLA"
      subtitle="Family"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      pageTitle={current.title}
      pageDescription={current.desc}
      headerActions={
        caregiver ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              toast({ title: "Calling Caregiver", description: `Connecting you with ${caregiver.name}...` })
            }
          >
            <Phone className="w-4 h-4" />
            Call Caregiver
          </Button>
        ) : undefined
      }
    >
      {alertBannerVisible && familyAlertBanner && (
        <div className="mb-4">
          <FamilyAlertBanner
            alert={familyAlertBanner}
            onClose={() => {
              setAlertBannerVisible(false);
              clearLatest();
            }}
          />
        </div>
      )}
      {activeTab === "status" && (
        <FamilyStatus
          patients={patients}
          selectedPatientId={selectedPatient?.id ?? null}
          onSelectPatient={setSelectedPatientId}
          patient={selectedPatient}
          caregiver={caregiver}
          alerts={alerts}
          loading={loading}
          onCallCaregiver={() =>
            toast({
              title: "Calling Caregiver",
              description: `Connecting you with ${caregiver?.name ?? "caregiver"}...`,
            })
          }
          onMessageCaregiver={() => handleTabChange("messages")}
        />
      )}

      {activeTab === "location" && (
        <FamilyLocation
          patients={patients}
          selectedPatientId={selectedPatient?.id ?? null}
          onSelectPatient={setSelectedPatientId}
          patient={selectedPatient}
        />
      )}

      {activeTab === "messages" && (
        <CaregiverMessages
          contacts={messageContacts}
          conversations={conversations}
          loading={loadingMessages}
          onLoadConversations={loadConversations}
        />
      )}
    </PortalLayout>
  );
};

export default Family;
