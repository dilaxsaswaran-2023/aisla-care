import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, HeartPulse, Clock, Phone, MessageSquare, Shield, AlertTriangle, UserRound, Bell, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatDateTime, formatTime, getTodayLocalDateString } from "@/lib/datetime";

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity?: string;
  priority?: string;
  status: string;
  created_at: string;
}

interface MedicationMonitorItem {
  schedule_id: string;
  medication_name: string;
  description?: string;
  urgency_level: string;
  time: string;
  scheduled_for_at: string;
  due_at: string;
  status: "pending" | "taken" | "missed";
  taken_at?: string;
  monitor_id?: string;
  can_mark_done: boolean;
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

interface FamilyStatusProps {
  patients: PatientItem[];
  selectedPatientId: string | null;
  onSelectPatient: (id: string) => void;
  patient: PatientItem | null;
  caregiver: { id: string; name: string } | null;
  alerts: AlertItem[];
  loading: boolean;
  onCallCaregiver: () => void;
  onMessageCaregiver: () => void;
}

const getAlertLevel = (alerts: AlertItem[]) => {
  const unresolved = alerts.filter((a) => a.status !== "resolved" && a.status !== "read");
  const hasCritical = unresolved.some((a) => (a.severity || a.priority || "").toLowerCase() === "critical");
  const hasHigh = unresolved.some((a) => (a.severity || a.priority || "").toLowerCase() === "high");

  if (hasCritical) return { label: "Attention Needed", color: "text-red-700", dot: "bg-red-600" };
  if (hasHigh) return { label: "Watch Closely", color: "text-amber-700", dot: "bg-amber-500" };
  return { label: "Stable", color: "text-green-700", dot: "bg-green-600" };
};

const FamilyStatus = ({
  patients,
  selectedPatientId,
  onSelectPatient,
  patient,
  caregiver,
  alerts,
  loading,
  onCallCaregiver,
  onMessageCaregiver,
}: FamilyStatusProps) => {
  const [medicationItems, setMedicationItems] = useState<MedicationMonitorItem[]>([]);
  const [loadingMedication, setLoadingMedication] = useState(false);
  const recentAlerts = alerts.slice(0, 6);
  const status = getAlertLevel(alerts);

  const loadMedicationStatus = async (patientId: string) => {
    if (!patientId) return;
    setLoadingMedication(true);
    try {
      const today = getTodayLocalDateString();
      const response = await api.get(`/medication-schedules/monitor?patient_id=${patientId}&date=${today}`) as {
        date?: string;
        items?: MedicationMonitorItem[];
      };
      const data = response?.items || [];
      setMedicationItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading medication status:', error);
      setMedicationItems([]);
    } finally {
      setLoadingMedication(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadMedicationStatus(selectedPatientId);
    }
  }, [selectedPatientId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!patient) {
    return (
      <Card className="care-card">
        <CardContent className="py-10 text-center text-muted-foreground">
          No linked patients found for this family account.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="care-card">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {patients.map((p) => (
              <Button
                key={p.id}
                variant={selectedPatientId === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectPatient(p.id)}
                className="h-8"
              >
                <UserRound className="w-3.5 h-3.5 mr-1.5" />
                {p.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="care-card md:col-span-2">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Condition</p>
              <HeartPulse className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
              <span className={`text-2xl font-semibold ${status.color}`}>{status.label}</span>
            </div>
            <p className="text-sm text-muted-foreground">{patient.name}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p>{patient.phone_country || ""} {patient.phone_number || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last profile update</p>
                <p>{patient.updated_at ? formatDateTime(patient.updated_at) : "-"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Address</p>
                <p>{patient.address || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="care-card">
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Geofence</p>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <Badge variant={patient.is_geofencing ? "default" : "secondary"}>
                {patient.is_geofencing ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-sm">
              State: <span className="font-medium capitalize">{patient.geofence_state || "unknown"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Geofence alerts will appear when movement crosses configured boundaries.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="care-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No recent alerts</p>
          ) : (
            recentAlerts.map((alert) => {
              const sev = (alert.severity || alert.priority || "low").toLowerCase();
              const isCritical = sev === "critical" || sev === "high";
              return (
                <div key={alert.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">{alert.title}</p>
                      {alert.message ? (
                        <p className="text-xs text-muted-foreground mt-1 break-words">{alert.message}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDateTime(alert.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCritical ? <AlertTriangle className="w-4 h-4 text-red-600" /> : null}
                      <Badge variant="outline" className="capitalize text-xs">{sev}</Badge>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="care-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              Today's Medication Status ({medicationItems.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => selectedPatientId && loadMedicationStatus(selectedPatientId)}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMedication ? (
            <p className="text-sm text-muted-foreground">Loading medication status...</p>
          ) : medicationItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No medication scheduled for today.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {medicationItems.map((item) => {
                const key = `${item.schedule_id}-${item.time}`;
                const isDone = item.status === "taken";
                const isMissed = item.status === "missed";
                const statusVariant = isDone ? "default" : isMissed ? "destructive" : "secondary";
                const statusLabel = isDone ? "Taken" : isMissed ? "Missed" : "Pending";
                
                return (
                  <div key={key} className="p-4 border rounded-lg space-y-3 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{item.medication_name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col">
                        <span className="font-medium text-muted-foreground">Scheduled Time</span>
                        <span className="font-semibold">{item.time}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-muted-foreground">Status</span>
                        <Badge variant={statusVariant} className="text-xs w-fit">
                          {statusLabel}
                        </Badge>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-muted-foreground">Scheduled For</span>
                        <span>{formatTime(item.scheduled_for_at)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-muted-foreground">Due At</span>
                        <span>{formatTime(item.due_at)}</span>
                      </div>
                      {item.taken_at && (
                        <div className="col-span-2 flex flex-col">
                          <span className="font-medium text-green-600">Taken At</span>
                          <span className="text-green-600 font-semibold">{formatTime(item.taken_at)}</span>
                        </div>
                      )}
                      {item.urgency_level && (
                        <div className="flex flex-col">
                          <span className="font-medium text-muted-foreground">Urgency</span>
                          <Badge
                            variant={item.urgency_level === 'high' ? 'destructive' : item.urgency_level === 'low' ? 'secondary' : 'default'}
                            className="text-xs w-fit"
                          >
                            {item.urgency_level.toUpperCase()}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="care-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Care Team Contact</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-medium">{caregiver?.name || "Caregiver"}</p>
            <p className="text-xs text-muted-foreground">Primary caregiver for this patient</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onCallCaregiver} className="gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Call
            </Button>
            <Button size="sm" variant="outline" onClick={onMessageCaregiver} className="gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Message
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FamilyStatus;
