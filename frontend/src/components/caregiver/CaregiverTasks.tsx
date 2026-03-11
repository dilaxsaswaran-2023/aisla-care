import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TaskScheduler from "@/components/dashboard/TaskScheduler";

export const CaregiverTasks = () => {
  return (
    <Card className="care-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Task & Reminder Scheduler</CardTitle>
        <CardDescription>Manage patient reminders and activities</CardDescription>
      </CardHeader>
      <CardContent>
        <TaskScheduler />
      </CardContent>
    </Card>
  );
};
