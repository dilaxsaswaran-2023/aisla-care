import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw } from "lucide-react";
import { addDays, addWeeks, format, startOfWeek, subDays, subWeeks } from "date-fns";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import MedicationScheduleDialog from "@/components/patient/MedicationScheduleDialog";
import MedicationCalendarView from "@/components/caregiver/medication/MedicationCalendarView";
import {
  MedicationFlowCard,
  MedicationMonitorItem,
  MedicationScheduleItem,
  MedicationSchedulesCard,
} from "@/components/caregiver/medication/MedicationShared";

interface PatientContact {
  id: string;
  name: string;
}

export const CaregiverTasks = ({ patients }: { patients: PatientContact[] }) => {
  const { toast } = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [schedules, setSchedules] = useState<MedicationScheduleItem[]>([]);
  const [monitorItems, setMonitorItems] = useState<MedicationMonitorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarMode, setCalendarMode] = useState<"day" | "week">("day");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [calendarDayItems, setCalendarDayItems] = useState<MedicationMonitorItem[]>([]);
  const [calendarWeekItems, setCalendarWeekItems] = useState<Record<string, MedicationMonitorItem[]>>({});
  
  // Schedule management state
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

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  useEffect(() => {
    if (!selectedPatientId && patients.length > 0) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  const selectedPatientName = useMemo(
    () => patients.find((p) => p.id === selectedPatientId)?.name || "",
    [patients, selectedPatientId]
  );

  const toDateKey = (date: Date): string => format(date, "yyyy-MM-dd");

  const getWeekDates = (date: Date): Date[] => {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  };

  const loadMedicationData = async (patientId: string, targetDate: Date) => {
    if (!patientId) return;
    setLoading(true);
    try {
      const dateKey = toDateKey(targetDate);
      const [schedulesData, monitorData] = await Promise.all([
        api.get(`/medication-schedules?patient_id=${patientId}`) as Promise<MedicationScheduleItem[]>,
        api.get(`/medication-schedules/monitor?patient_id=${patientId}&date=${dateKey}`) as Promise<{ items?: MedicationMonitorItem[] }>,
      ]);

      setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
      setMonitorItems(Array.isArray(monitorData?.items) ? monitorData.items : []);
    } catch {
      setSchedules([]);
      setMonitorItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarData = async (
    patientId: string,
    targetDate: Date,
    mode: "day" | "week",
  ) => {
    if (!patientId) return;
    setCalendarLoading(true);
    try {
      if (mode === "day") {
        const dayKey = toDateKey(targetDate);
        const dayData = await api.get(
          `/medication-schedules/monitor?patient_id=${patientId}&date=${dayKey}`,
        ) as { items?: MedicationMonitorItem[] };

        setCalendarDayItems(Array.isArray(dayData?.items) ? dayData.items : []);
        setCalendarWeekItems({});
      } else {
        const weekDates = getWeekDates(targetDate);
        const weekResponses = await Promise.all(
          weekDates.map((date) =>
            api.get(
              `/medication-schedules/monitor?patient_id=${patientId}&date=${toDateKey(date)}`,
            ) as Promise<{ items?: MedicationMonitorItem[] }>
          ),
        );

        const weekMap: Record<string, MedicationMonitorItem[]> = {};
        weekDates.forEach((date, index) => {
          const key = toDateKey(date);
          weekMap[key] = Array.isArray(weekResponses[index]?.items) ? weekResponses[index].items : [];
        });
        setCalendarWeekItems(weekMap);
        setCalendarDayItems(weekMap[toDateKey(targetDate)] || []);
      }
    } catch {
      setCalendarDayItems([]);
      setCalendarWeekItems({});
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      void Promise.all([
        loadMedicationData(selectedPatientId, calendarDate),
        loadCalendarData(selectedPatientId, calendarDate, calendarMode),
      ]);
    }
  }, [selectedPatientId, calendarDate, calendarMode]);

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

  const handleAddSchedule = async () => {
    if (!selectedPatientId) return;

    try {
      const payload = {
        patient_id: selectedPatientId,
        ...scheduleForm,
        scheduled_times: scheduleForm.scheduled_times.filter(t => t.trim() !== ""),
      };
      let updatedSchedule: MedicationScheduleItem;
      if (editingScheduleId) {
        updatedSchedule = await api.patch(`/medication-schedules/${editingScheduleId}`, payload) as MedicationScheduleItem;
        setSchedules(prev => prev.map(s => s.id === editingScheduleId ? updatedSchedule : s));
        toast({
          title: "Success",
          description: "Medication schedule updated successfully",
        });
      } else {
        updatedSchedule = await api.post('/medication-schedules', payload) as MedicationScheduleItem;
        setSchedules(prev => [...prev, updatedSchedule]);
        toast({
          title: "Success",
          description: "Medication schedule added successfully",
        });
      }
      setAddScheduleOpen(false);
      resetScheduleForm();
      setEditingScheduleId(null);
      void refreshAllMedicationPanels();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save medication schedule",
        variant: "destructive",
      });
    }
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

  const handleToggleActive = (scheduleId: string) => {
    setScheduleToToggle(scheduleId);
    setToggleConfirmOpen(true);
  };

  const confirmToggleActive = async () => {
    if (!scheduleToToggle) return;
    try {
      const res = await api.patch(`/medication-schedules/${scheduleToToggle}/toggle-active`) as MedicationScheduleItem | { success: boolean; is_active: boolean };
      if (res && 'id' in res && res.id) {
        setSchedules(prev => prev.map(s => s.id === (res as MedicationScheduleItem).id ? (res as MedicationScheduleItem) : s));
      } else {
        setSchedules(prev => prev.map(s => s.id === scheduleToToggle ? { ...s, is_active: !s.is_active } : s));
      }
      setToggleConfirmOpen(false);
      setScheduleToToggle(null);
      toast({ title: 'Success', description: 'Schedule status updated' });
      void refreshAllMedicationPanels();
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

  const handleCalendarPrevious = () => {
    setCalendarDate((previous) => (
      calendarMode === "day" ? subDays(previous, 1) : subWeeks(previous, 1)
    ));
  };

  const handleCalendarNext = () => {
    setCalendarDate((previous) => (
      calendarMode === "day" ? addDays(previous, 1) : addWeeks(previous, 1)
    ));
  };

  const handleCalendarToday = () => {
    setCalendarDate(new Date());
  };

  const refreshAllMedicationPanels = async () => {
    if (!selectedPatientId) return;
    await Promise.all([
      loadMedicationData(selectedPatientId, calendarDate),
      loadCalendarData(selectedPatientId, calendarDate, calendarMode),
    ]);
  };

  return (
    <div className="space-y-4">
      <Card className="care-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Medication Schedules</CardTitle>
              <CardDescription>View schedules and today's medication status</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!selectedPatientId || loading}
              onClick={() => selectedPatientId && refreshAllMedicationPanels()}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {patients.map((p) => (
              <Button
                key={p.id}
                variant={selectedPatientId === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPatientId(p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MedicationSchedulesCard
          schedules={schedules}
          dayNames={dayNames}
          onEdit={handleEditSchedule}
          onToggleActive={handleToggleActive}
          className="care-card"
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

        <MedicationFlowCard
          items={monitorItems}
          loading={loading}
          title={`Medication Monitor - ${format(calendarDate, "MMM d, yyyy")}`}
          emptyLabel="No monitor items for the selected date."
          loadingLabel="Loading monitor status..."
          className="care-card"
        />
      </div>

      <div className="w-full xl:w-[100%]">
        <MedicationCalendarView
          patientName={selectedPatientName}
          mode={calendarMode}
          onModeChange={setCalendarMode}
          referenceDate={calendarDate}
          onPrevious={handleCalendarPrevious}
          onNext={handleCalendarNext}
          onToday={handleCalendarToday}
          dayItems={calendarDayItems}
          weekItemsByDate={calendarWeekItems}
          loading={calendarLoading}
        />
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
  );
};
