import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  User,
  AlertCircle,
  Pill,
  Plus,
  Clock,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Activity
  , Edit, Power } from "lucide-react";
import MedicationScheduleDialog from "@/components/patient/MedicationScheduleDialog";

interface Patient {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  is_geofencing?: boolean;
  location_boundary?: { latitude: number; longitude: number };
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

const PatientDetail = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [medicationSchedules, setMedicationSchedules] = useState<MedicationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [scheduleToToggle, setScheduleToToggle] = useState<string | null>(null);

  // Form state for new medication schedule
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
      // Load patient details
      const patientData = await api.get(`/users/${patientId}`) as Patient;
      setPatient(patientData);

      // Load alerts for this patient
      const alertsData = await api.get('/alerts/me') as Alert[];
      const patientAlerts = alertsData.filter((alert: Alert) => {
        // This is a simplified filter - in reality you'd need to check relationships
        return alert.patient_name === patientData.full_name;
      });
      setAlerts(patientAlerts);

      // Load medication schedules
      const schedulesData = await api.get(`/medication-schedules?patient_id=${patientId}`) as MedicationSchedule[];
      setMedicationSchedules(schedulesData);
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

  const handleAddSchedule = async () => {
    if (!patientId) return;

    try {
      const payload = {
        patient_id: patientId,
        ...scheduleForm,
        scheduled_times: scheduleForm.scheduled_times.filter(t => t.trim() !== ""),
      };
      let updatedSchedule;
      if (editingScheduleId) {
        updatedSchedule = await api.patch(`/medication-schedules/${editingScheduleId}`, payload);
        setMedicationSchedules(prev => prev.map(s => s.id === editingScheduleId ? updatedSchedule : s));
        toast({
          title: "Success",
          description: "Medication schedule updated successfully",
        });
      } else {
        updatedSchedule = await api.post('/medication-schedules', payload);
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
      days_of_week: [],
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
    // open confirmation dialog and set target schedule
    setScheduleToToggle(scheduleId);
    setToggleConfirmOpen(true);
  };

  const confirmToggleActive = async () => {
    if (!scheduleToToggle) return;
    try {
      const res = await api.patch(`/medication-schedules/${scheduleToToggle}/toggle-active`);
      // If API returned the updated schedule, replace it, otherwise toggle locally
      if (res && res.id) {
        setMedicationSchedules(prev => prev.map(s => s.id === res.id ? res : s));
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
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Patient Not Found</h1>
          <Button onClick={() => navigate('/caregiver?tab=patients')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Patients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/caregiver?tab=patients')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Patients
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{patient.full_name}</h1>
              <p className="text-muted-foreground">Patient Details</p>
            </div>
          </div>
        </div>

        {/* Patient Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{patient.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{patient.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{patient.address || 'No address'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <Badge variant="outline">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground">No recent alerts</p>
            ) : (
              <div className="space-y-3">
                {alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={alert.priority === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          </Card>

          {/* Medication Schedules */}
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Pill className="w-5 h-5" />
                Medication Schedules
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
          <CardContent>
            {medicationSchedules.length === 0 ? (
              <p className="text-muted-foreground">No medication schedules</p>
            ) : (
              <div className="space-y-2">
                {medicationSchedules.map((schedule) => (
                  <div key={schedule.id} className="p-3 border rounded-md flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{schedule.name}</h3>
                        {schedule.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xl">{schedule.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{schedule.scheduled_times.join(', ')}</span>
                          </div>
                          {schedule.schedule_type !== 'daily' && schedule.days_of_week && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{schedule.days_of_week.map(d => dayNames[d]).join(', ')}</span>
                            </div>
                          )}
                          {schedule.dosage_type && schedule.dosage_count && (
                            <div className="flex items-center gap-1">
                              <Pill className="w-3 h-3" />
                              <span>{schedule.dosage_count} {schedule.dosage_type}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSchedule(schedule)}
                          aria-label={`Edit ${schedule.name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(schedule.id)}
                          aria-label={`${schedule.is_active ? 'Deactivate' : 'Activate'} ${schedule.name}`}
                        >
                          <Power className={`w-4 h-4 ${schedule.is_active ? '' : 'text-muted-foreground'}`} />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                      <Badge
                        variant={schedule.urgency_level === 'high' ? 'destructive' : schedule.urgency_level === 'low' ? 'secondary' : 'default'}
                      >
                        {schedule.urgency_level ? schedule.urgency_level.toUpperCase() : 'MED'}
                      </Badge>

                      <Badge variant={schedule.is_active ? 'default' : 'secondary'} className="text-xs">
                        {schedule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{schedule.grace_period_minutes} min</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          </Card>
        </div>

        {/* Toggle Confirmation Dialog */}
        <Dialog open={toggleConfirmOpen} onOpenChange={setToggleConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to toggle the active status of this medication schedule?</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setToggleConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmToggleActive}>
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