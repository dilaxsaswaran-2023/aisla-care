import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  User,
  AlertCircle,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Activity
} from "lucide-react";
import MedicationScheduleDialog from "@/components/patient/MedicationScheduleDialog";
import { formatDate, getTodayLocalDateString } from "@/lib/datetime";
import {
  MedicationFlowCard,
  MedicationMonitorItem,
  MedicationScheduleItem,
  MedicationSchedulesCard,
} from "@/components/caregiver/medication/MedicationShared";

interface Patient {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  address?: string;
  role?: string;
  is_geofencing?: boolean;
  location_boundary?: { latitude: number; longitude: number } | null;
  boundary_radius?: number;
}

interface Alert {
  id: string;
  alert_type: string;
  status: string;
  priority: string;
  title: string;
  message: string;
  created_at: string;
  patient_name?: string;
}

const PatientDetail = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [medicationSchedules, setMedicationSchedules] = useState<MedicationScheduleItem[]>([]);
  const [medicationItems, setMedicationItems] = useState<MedicationMonitorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMedication, setLoadingMedication] = useState(false);
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [scheduleToToggle, setScheduleToToggle] = useState<string | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    description: "",
    prescription: "",
    schedule_type: "daily",
    scheduled_times: [""],
    days_of_week: [] as number[],
    meal_timing: "",
    dosage_type: "",
    dosage_count: 1,
    urgency_level: "medium",
    grace_period_minutes: 60,
    is_active: true,
  });

  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId]);

  const loadPatientData = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const patientData = await api.get(`/users/${patientId}`) as Patient;
      setPatient(patientData);

      const alertsData = await api.get('/alerts/me') as Alert[];
      const patientAlerts = alertsData.filter((alert: Alert) => {
        return alert.patient_name === patientData.full_name;
      });
      setAlerts(patientAlerts);

      const schedulesData = await api.get(`/medication-schedules?patient_id=${patientId}`) as MedicationScheduleItem[];
      setMedicationSchedules(schedulesData);

      await loadMedicationStatus(patientId);
    } catch (error) {
      console.error('Error loading patient data:', error);
      toast({
        title: "Error",
        description: "Failed to load patient data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMedicationStatus = async (pId: string) => {
    if (!pId) return;
    setLoadingMedication(true);
    try {
      const today = getTodayLocalDateString();
      const response = await api.get(`/medication-schedules/monitor?patient_id=${pId}&date=${today}`) as {
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

  const handleAddSchedule = async () => {
    if (!patientId) return;

    try {
      const payload = {
        patient_id: patientId,
        ...scheduleForm,
        scheduled_times: scheduleForm.scheduled_times.filter(t => t.trim() !== ""),
      };
      let updatedSchedule: MedicationScheduleItem;
      if (editingScheduleId) {
        updatedSchedule = await api.patch(`/medication-schedules/${editingScheduleId}`, payload) as MedicationScheduleItem;
        setMedicationSchedules(prev => prev.map(s => s.id === editingScheduleId ? updatedSchedule : s));
        toast({
          title: "Success",
          description: "Medication schedule updated successfully",
        });
      } else {
        updatedSchedule = await api.post('/medication-schedules', payload) as MedicationScheduleItem;
        setMedicationSchedules(prev => [...prev, updatedSchedule]);
        toast({
          title: "Success",
          description: "Medication schedule added successfully",
        });
      }
      setAddScheduleOpen(false);
      resetScheduleForm();
      setEditingScheduleId(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save medication schedule",
        variant: "destructive",
      });
    }
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      name: "",
      description: "",
      prescription: "",
      schedule_type: "daily",
      scheduled_times: [""],
      days_of_week: [] as number[],
      meal_timing: "",
      dosage_type: "",
      dosage_count: 1,
      urgency_level: "medium",
      grace_period_minutes: 60,
      is_active: true,
    });
    setEditingScheduleId(null);
  };

  const handleEditSchedule = (schedule: MedicationScheduleItem) => {
    setScheduleForm({
      name: schedule.name || "",
      description: schedule.description || "",
      prescription: schedule.prescription || "",
      schedule_type: schedule.schedule_type || "daily",
      scheduled_times: schedule.scheduled_times && schedule.scheduled_times.length ? schedule.scheduled_times : [""],
      days_of_week: schedule.days_of_week || [],
      meal_timing: schedule.meal_timing || "",
      dosage_type: schedule.dosage_type || "",
      dosage_count: schedule.dosage_count || 1,
      urgency_level: schedule.urgency_level || "medium",
      grace_period_minutes: schedule.grace_period_minutes || 60,
      is_active: schedule.is_active,
    });
    setEditingScheduleId(schedule.id);
    setAddScheduleOpen(true);
  };

  const handleToggleActive = async (scheduleId: string) => {
    setScheduleToToggle(scheduleId);
    setToggleConfirmOpen(true);
  };

  const confirmToggleActive = async () => {
    if (!scheduleToToggle) return;
    try {
      const res = await api.patch(`/medication-schedules/${scheduleToToggle}/toggle-active`) as MedicationScheduleItem | { success: boolean; is_active: boolean };
      if (res && 'id' in res && res.id) {
        setMedicationSchedules(prev => prev.map(s => s.id === (res as MedicationScheduleItem).id ? (res as MedicationScheduleItem) : s));
      } else {
        setMedicationSchedules(prev => prev.map(s => s.id === scheduleToToggle ? { ...s, is_active: !s.is_active } : s));
      }
      setToggleConfirmOpen(false);
      setScheduleToToggle(null);
      toast({ title: 'Success', description: 'Schedule status updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to toggle schedule', variant: 'destructive' });
    }
  };

  const addTimeSlot = () => {
    setScheduleForm(prev => ({
      ...prev,
      scheduled_times: [...prev.scheduled_times, ""],
    }));
  };

  const updateTimeSlot = (index: number, value: string) => {
    setScheduleForm(prev => ({
      ...prev,
      scheduled_times: prev.scheduled_times.map((time, i) => i === index ? value : time),
    }));
  };

  const removeTimeSlot = (index: number) => {
    setScheduleForm(prev => ({
      ...prev,
      scheduled_times: prev.scheduled_times.filter((_, i) => i !== index),
    }));
  };

  const toggleDayOfWeek = (day: number) => {
    setScheduleForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day],
    }));
  };

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded-2xl w-1/3"></div>
            <div className="h-36 bg-muted rounded-2xl"></div>
            <div className="h-72 bg-muted rounded-2xl"></div>
            <div className="h-72 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <User className="w-7 h-7 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Patient Not Found</h1>
          <p className="text-muted-foreground mb-6">The requested patient record could not be loaded.</p>
          <Button onClick={() => navigate('/caregiver?tab=patients')} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Patients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 md:p-4">
      <div className="max-w-[80vw] mx-auto space-y-4">
        <div className="rounded-[28px] border bg-card/90 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/caregiver?tab=patients')}
                className="rounded-xl h-9 px-3 shrink-0"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div className="w-12 h-12 rounded-2xl border bg-muted flex items-center justify-center shrink-0">
                <span className="text-sm font-bold">
                  {patient.full_name
                    ?.split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{patient.full_name}</h1>
                  <Badge className="rounded-lg">{patient.role || "Patient"}</Badge>
                  <Badge variant="outline" className="rounded-lg">Active</Badge>
                  <Badge variant={patient.is_geofencing ? "default" : "secondary"} className="rounded-lg">
                    {patient.is_geofencing ? "Geo On" : "Geo Off"}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  Compact patient operations view
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-2xl border bg-background px-3 py-2 min-w-[90px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Alerts</p>
                <p className="text-lg font-semibold mt-1 leading-none">{alerts.length}</p>
              </div>
              <div className="rounded-2xl border bg-background px-3 py-2 min-w-[90px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Schedules</p>
                <p className="text-lg font-semibold mt-1 leading-none">{medicationSchedules.length}</p>
              </div>
              <div className="rounded-2xl border bg-background px-3 py-2 min-w-[90px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Today</p>
                <p className="text-lg font-semibold mt-1 leading-none">{medicationItems.length}</p>
              </div>
              <div className="rounded-2xl border bg-background px-3 py-2 min-w-[90px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Critical</p>
                <p className="text-lg font-semibold mt-1 leading-none">
                  {alerts.filter((a) => a.priority === "critical").length}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {patient.email && (
              <div className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 text-xs">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate max-w-[220px]">{patient.email}</span>
              </div>
            )}
            {patient.phone && (
              <div className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 text-xs">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{patient.phone}</span>
              </div>
            )}
            {patient.address && (
              <div className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate max-w-[260px]">{patient.address}</span>
              </div>
            )}
            {patient.boundary_radius ? (
              <div className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 text-xs">
                <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{patient.boundary_radius}m radius</span>
              </div>
            ) : null}
            {patient.is_geofencing && patient.location_boundary && patient.location_boundary.latitude !== undefined && patient.location_boundary.longitude !== undefined ? (
              <div className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  {patient.location_boundary.latitude.toFixed(4)}, {patient.location_boundary.longitude.toFixed(4)}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-3 space-y-4">
            <Card className="rounded-[28px] border shadow-sm">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  Alerts
                  <Badge variant="secondary" className="rounded-lg">{alerts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {alerts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                    No alerts
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[780px] overflow-auto pr-1">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="rounded-2xl border bg-background p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm leading-5">{alert.title}</p>
                          <Badge
                            variant={alert.priority === "critical" ? "destructive" : "secondary"}
                            className="text-[10px] rounded-lg shrink-0"
                          >
                            {alert.priority}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{alert.message}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-[10px] rounded-lg">{alert.alert_type}</Badge>
                          <Badge variant="outline" className="text-[10px] rounded-lg">{alert.status}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">{formatDate(alert.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-4 space-y-4">
            <MedicationFlowCard
              items={medicationItems}
              loading={loadingMedication}
              onRefresh={() => patientId && loadMedicationStatus(patientId)}
            />
          </div>

          <div className="xl:col-span-5 space-y-4">
            <MedicationSchedulesCard
              schedules={medicationSchedules}
              dayNames={dayNames}
              onEdit={handleEditSchedule}
              onToggleActive={handleToggleActive}
              actionNode={
                <MedicationScheduleDialog
                  open={addScheduleOpen}
                  onOpenChange={setAddScheduleOpen}
                  scheduleForm={scheduleForm}
                  setScheduleForm={setScheduleForm}
                  addTimeSlot={addTimeSlot}
                  updateTimeSlot={updateTimeSlot}
                  removeTimeSlot={removeTimeSlot}
                  toggleDayOfWeek={toggleDayOfWeek}
                  handleAddSchedule={handleAddSchedule}
                  isEditing={!!editingScheduleId}
                  submitLabel={editingScheduleId ? 'Save Changes' : undefined}
                />
              }
            />
          </div>
        </div>

        <Dialog open={toggleConfirmOpen} onOpenChange={setToggleConfirmOpen}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to toggle the active status of this medication schedule?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" className="rounded-xl" onClick={() => setToggleConfirmOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl" onClick={confirmToggleActive}>
                Confirm
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PatientDetail;