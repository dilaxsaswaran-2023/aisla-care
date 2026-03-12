import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import PortalLayout from "@/components/layout/PortalLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import FamilyStatus from "@/components/family/FamilyStatus";
import FamilyLocation from "@/components/family/FamilyLocation";
import FamilyMessages from "@/components/family/FamilyMessages";
import { Activity, MapPin, MessageSquare } from "lucide-react";

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  created_at: string;
}

const navItems = [
  { label: "Status", value: "status", icon: Activity },
  { label: "Location", value: "location", icon: MapPin },
  { label: "Messages", value: "messages", icon: MessageSquare },
];

const Family = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("status");
  const { toast } = useToast();
  const { user } = useAuth();

  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [caregiver, setCaregiver] = useState<{ id: string; name: string } | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync active tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get("tab") || "status";
    setActiveTab(tabFromUrl);
  }, [location.search]);

  useEffect(() => {
    if (!user) return;
    loadPatientData();
    loadAlerts();
  }, [user]);

  const loadPatientData = async () => {
    try {
      const data = (await api.get("/users/patients")) as any[];
      if (data && data.length > 0) {
        const pt = data[0];
        if (pt?.id || pt?._id) setPatient({ id: pt.id ?? pt._id, name: pt.full_name ?? "Patient" });
        if (pt?.caregiver_id || pt?.caregiver?._id) {
          const cg = pt.caregiver;
          if (cg?._id) setCaregiver({ id: cg._id, name: cg.full_name ?? "Caregiver" });
        }
      }
    } catch {
      // patients not available
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

  // Handle tab change and update URL
  const handleTabChange = (tab: string) => {
    navigate(`?tab=${tab}`, { replace: true });
  };

  const pageTitles: Record<string, { title: string; desc: string }> = {
    status: { title: "Patient Status", desc: patient ? `${patient.name} — Your Patient` : "Loading…" },
    location: { title: "Location", desc: "Real-time location monitoring" },
    messages: { title: "Messages", desc: caregiver ? `Chat with ${caregiver.name}` : "Updates from the care team" },
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
              toast({ title: "Calling Caregiver", description: `Connecting you with ${caregiver.name}…` })
            }
          >
            <Phone className="w-4 h-4" />
            Call Caregiver
          </Button>
        ) : undefined
      }
    >
      {activeTab === "status" && (
        <FamilyStatus
          patient={patient}
          caregiver={caregiver}
          alerts={alerts}
          loading={loading}
          onCallCaregiver={() =>
            toast({ title: "Calling Caregiver", description: `Connecting you with ${caregiver?.name ?? "caregiver"}…` })
          }
          onMessageCaregiver={() => handleTabChange("messages")}
        />
      )}

      {activeTab === "location" && (
        <FamilyLocation patientId={patient?.id ?? null} patientName={patient?.name ?? "Patient"} />
      )}

      {activeTab === "messages" && (
        <FamilyMessages caregiverId={caregiver?.id ?? null} caregiverName={caregiver?.name ?? "Caregiver"} />
      )}
    </PortalLayout>
  );
};

export default Family;

