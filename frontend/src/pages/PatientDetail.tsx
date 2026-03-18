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
  Pill,
  Bell,
  RefreshCw,
  Edit,
  Power,
  Mail,
  Phone,
  MapPin,
  Activity
} from "lucide-react";
import MedicationScheduleDialog from "@/components/patient/MedicationScheduleDialog";

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

interface MedicationSchedule {
  id: string;
  name: string;
  description?: string;
  prescription?: string;
  schedule_type: string;
  scheduled_times: string[];
  days_of_week?: number[];
  meal_timing?: string;
  dosage_type?: string;
  dosage_count?: number;
  urgency_level?: string;
  grace_period_minutes?: number;
  is_active: boolean;
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

const PatientDetail = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [medicationSchedules, setMedicationSchedules] = useState<MedicationSchedule[]>([]);
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

      const schedulesData = await api.get(`/medication-schedules?patient_id=${patientId}`) as MedicationSchedule[];
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
      const today = new Date().toISOString().slice(0, 10);
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
      let updatedSchedule: MedicationSchedule;
      if (editingScheduleId) {
        updatedSchedule = await api.patch(`/medication-schedules/${editingScheduleId}`, payload) as MedicationSchedule;
        setMedicationSchedules(prev => prev.map(s => s.id === editingScheduleId ? updatedSchedule : s));
        toast({
          title: "Success",
          description: "Medication schedule updated successfully",
        });
      } else {
        updatedSchedule = await api.post('/medication-schedules', payload) as MedicationSchedule;
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

  const handleEditSchedule = (schedule: MedicationSchedule) => {
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
      const res = await api.patch(`/medication-schedules/${scheduleToToggle}/toggle-active`) as MedicationSchedule | { success: boolean; is_active: boolean };
      if (res && 'id' in res && res.id) {
        setMedicationSchedules(prev => prev.map(s => s.id === (res as MedicationSchedule).id ? (res as MedicationSchedule) : s));
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
      <div className="max-w-[1600px] mx-auto space-y-4">
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
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {new Date(alert.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-4 space-y-4">
            <Card className="rounded-[28px] border shadow-sm">
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    Today’s Medication Flow
                    <Badge variant="secondary" className="rounded-lg">{medicationItems.length}</Badge>
                  </CardTitle>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => patientId && loadMedicationStatus(patientId)}
                    className="rounded-xl h-8 px-2.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4">
                {loadingMedication ? (
                  <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : medicationItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                    No medication scheduled for today
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[780px] overflow-auto pr-1">
                    {medicationItems.map((item, index) => {
                      const key = `${item.schedule_id}-${item.time}`;
                      const isDone = item.status === "taken";
                      const isMissed = item.status === "missed";
                      const statusVariant = isDone ? "default" : isMissed ? "destructive" : "secondary";
                      const isLast = index === medicationItems.length - 1;
                      const dotClass = isDone
                        ? "bg-primary"
                        : isMissed
                        ? "bg-destructive"
                        : "bg-muted-foreground";

                      return (
                        <div key={key} className="flex gap-2.5 items-stretch">
                          <div className="relative w-4 shrink-0 flex justify-center">
                            {!isLast ? (
                              <div className="absolute top-4 bottom-[-8px] w-px bg-border" />
                            ) : null}
                            <div className={`relative z-10 mt-3 h-3 w-3 rounded-full border-2 border-background ${dotClass}`} />
                          </div>

                          <div className="flex-1 rounded-xl border bg-background px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-sm leading-5 truncate">{item.medication_name}</p>
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] rounded-md">
                                    {item.time}
                                  </Badge>
                                  {item.urgency_level ? (
                                    <Badge
                                      variant={item.urgency_level === 'high' ? 'destructive' : item.urgency_level === 'low' ? 'secondary' : 'default'}
                                      className="h-5 px-1.5 text-[10px] rounded-md"
                                    >
                                      {item.urgency_level.toUpperCase()}
                                    </Badge>
                                  ) : null}
                                </div>

                                {item.description ? (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                    {item.description}
                                  </p>
                                ) : null}
                              </div>

                              <Badge variant={statusVariant} className="h-5 px-1.5 text-[10px] rounded-md shrink-0">
                                {isDone ? "Taken" : isMissed ? "Missed" : "Pending"}
                              </Badge>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                              <div className="inline-flex items-center gap-1">
                                <span className="text-muted-foreground">Scheduled</span>
                                <span className="font-medium">
                                  {new Date(item.scheduled_for_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <div className="inline-flex items-center gap-1">
                                <span className="text-muted-foreground">Due</span>
                                <span className="font-medium">
                                  {new Date(item.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              {item.taken_at ? (
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-muted-foreground">Taken</span>
                                  <span className="font-medium text-green-600">
                                    {new Date(item.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-5 space-y-4">
            <Card className="rounded-[28px] border shadow-sm">
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                      <Pill className="w-4 h-4" />
                    </div>
                    Medication Schedules
                    <Badge variant="secondary" className="rounded-lg">{medicationSchedules.length}</Badge>
                  </CardTitle>

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
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4">
                {medicationSchedules.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No medication schedules
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[780px] overflow-auto pr-1">
                    {medicationSchedules.map((schedule) => (
                      <div key={schedule.id} className="rounded-2xl border bg-background p-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold truncate">{schedule.name}</h3>
                              <Badge
                                variant={schedule.urgency_level === 'high' ? 'destructive' : schedule.urgency_level === 'low' ? 'secondary' : 'default'}
                                className="text-[10px] rounded-lg"
                              >
                                {schedule.urgency_level ? schedule.urgency_level.toUpperCase() : "MEDIUM"}
                              </Badge>
                              <Badge variant={schedule.is_active ? 'default' : 'secondary'} className="text-[10px] rounded-lg">
                                {schedule.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>

                            {schedule.description ? (
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{schedule.description}</p>
                            ) : null}

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <div className="rounded-xl bg-muted/40 px-2 py-1 text-[11px]">
                                <span className="text-muted-foreground mr-1">Time</span>
                                <span className="font-medium">{schedule.scheduled_times.join(", ")}</span>
                              </div>
                              <div className="rounded-xl bg-muted/40 px-2 py-1 text-[11px]">
                                <span className="text-muted-foreground mr-1">Type</span>
                                <span className="font-medium capitalize">{schedule.schedule_type}</span>
                              </div>
                              <div className="rounded-xl bg-muted/40 px-2 py-1 text-[11px]">
                                <span className="text-muted-foreground mr-1">Grace</span>
                                <span className="font-medium">{schedule.grace_period_minutes}m</span>
                              </div>
                              {schedule.dosage_type ? (
                                <div className="rounded-xl bg-muted/40 px-2 py-1 text-[11px]">
                                  <span className="text-muted-foreground mr-1">Dose</span>
                                  <span className="font-medium">{schedule.dosage_count} {schedule.dosage_type}</span>
                                </div>
                              ) : null}
                              {schedule.meal_timing ? (
                                <div className="rounded-xl bg-muted/40 px-2 py-1 text-[11px] capitalize">
                                  {schedule.meal_timing.replace("_", " ")}
                                </div>
                              ) : null}
                            </div>

                            {schedule.days_of_week && schedule.days_of_week.length > 0 ? (
                              <p className="text-[11px] text-muted-foreground mt-2">
                                {schedule.days_of_week.map((d) => dayNames[d].slice(0, 3)).join(", ")}
                              </p>
                            ) : null}

                            {schedule.prescription ? (
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                                <span className="text-foreground font-medium">Prescription:</span> {schedule.prescription}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-col gap-1.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSchedule(schedule)}
                              className="rounded-xl h-8 px-3 text-xs justify-start"
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(schedule.id)}
                              className="rounded-xl h-8 px-3 text-xs justify-start"
                            >
                              <Power className={`w-3.5 h-3.5 mr-1 ${schedule.is_active ? '' : 'text-muted-foreground'}`} />
                              {schedule.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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