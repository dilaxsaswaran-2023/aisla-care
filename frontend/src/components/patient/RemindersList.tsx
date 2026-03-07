import { useEffect, useState } from "react";
import { Bell, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  scheduled_time: string;
  completed_at: string | null;
}

const sampleReminders: Reminder[] = [
  { id: 's-1', title: 'Morning Medication', description: 'Take blood pressure tablets with water', scheduled_time: new Date(Date.now() + 3600000).toISOString(), completed_at: null },
  { id: 's-2', title: 'Lunch Time', description: 'Prepared meal in fridge', scheduled_time: new Date(Date.now() + 7200000).toISOString(), completed_at: null },
  { id: 's-3', title: 'Afternoon Walk', description: '15 minute walk around the garden', scheduled_time: new Date(Date.now() + 14400000).toISOString(), completed_at: null },
  { id: 's-4', title: 'Morning Check-in', description: 'Daily wellness check completed', scheduled_time: new Date(Date.now() - 7200000).toISOString(), completed_at: new Date(Date.now() - 7000000).toISOString() },
];

const RemindersList = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReminders = async () => {
    if (!user) { setReminders(sampleReminders); setLoading(false); return; }
    try {
      const data = await api.get('/reminders');
      setReminders(data && data.length > 0 ? data : sampleReminders);
    } catch {
      setReminders(sampleReminders);
    }
    setLoading(false);
  };

  const markComplete = async (reminderId: string) => {
    if (reminderId.startsWith('s-')) {
      setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, completed_at: new Date().toISOString() } : r));
      return;
    }
    try {
      await api.patch(`/reminders/${reminderId}/complete`);
      loadReminders();
    } catch {
      console.error('Error completing reminder');
    }
  };

  useEffect(() => { loadReminders(); }, [user]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading reminders...</p>;

  return (
    <div className="space-y-2">
      {reminders.map((reminder) => {
        const isCompleted = !!reminder.completed_at;
        const scheduledTime = new Date(reminder.scheduled_time);
        const isUpcoming = scheduledTime > new Date();

        return (
          <div key={reminder.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
            isCompleted ? "bg-success/5 border-success/20" : isUpcoming ? "bg-warning/5 border-warning/20" : "bg-card border-border"
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? "bg-success/10" : "bg-warning/10"}`}>
              {isCompleted ? <Check className="w-4 h-4 text-success" /> : <Bell className="w-4 h-4 text-warning" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>{reminder.title}</p>
              <p className="text-xs text-muted-foreground">{format(scheduledTime, 'MMM d, h:mm a')}</p>
              {reminder.description && <p className="text-xs text-muted-foreground mt-0.5">{reminder.description}</p>}
            </div>
            {!isCompleted && (
              <Button size="sm" variant="outline" className="flex-shrink-0 h-7 text-xs" onClick={() => markComplete(reminder.id)}>Done</Button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RemindersList;
