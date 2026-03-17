import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock, User, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TaskScheduler = () => {
  const [taskTitle, setTaskTitle] = useState("");
  const { toast } = useToast();
  const tasks: any[] = [];

  const handleAddTask = () => {
    if (taskTitle.trim()) {
      toast({ title: "Task Added", description: `"${taskTitle}" has been scheduled` });
      setTaskTitle("");
    }
  };

  return (
    <div className="space-y-5">
      {/* Add task */}
      <div className="care-section space-y-3">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Plus className="w-4 h-4" />Create New Reminder
        </h3>
        <div className="flex gap-2">
          <Input placeholder="Enter task or reminder..." value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="flex-1 h-10" />
          <Button onClick={handleAddTask} className="h-10">Add</Button>
        </div>
      </div>

      {/* Schedule */}
      <div>
        <h3 className="section-label mb-3 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />Today's Schedule</h3>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="p-3.5 rounded-lg border bg-card border-border text-sm text-muted-foreground">No scheduled tasks.</div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className={`p-3.5 rounded-lg border ${task.completed ? "bg-success/5 border-success/20" : "bg-card border-border"} transition-all hover:shadow-sm`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${task.completed ? 'bg-success/10' : 'bg-muted'}`}>
                      {task.completed ? <Check className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className={`font-medium text-sm ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />{task.patient}</span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{task.time}</span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant={task.completed ? "outline" : "default"} className="h-7 text-xs flex-shrink-0">
                    {task.completed ? "Done" : "Mark Done"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskScheduler;
