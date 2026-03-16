import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

type ScheduleForm = {
  name: string;
  description: string;
  prescription: string;
  schedule_type: string;
  scheduled_times: string[];
  days_of_week: number[];
  meal_timing: string;
  dosage_type: string;
  dosage_count: number;
  is_active: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleForm: ScheduleForm;
  setScheduleForm: (fn: (prev: ScheduleForm) => ScheduleForm) => void;
  addTimeSlot: () => void;
  updateTimeSlot: (index: number, value: string) => void;
  removeTimeSlot: (index: number) => void;
  toggleDayOfWeek: (day: number) => void;
  handleAddSchedule: () => Promise<void>;
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MedicationScheduleDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  scheduleForm,
  setScheduleForm,
  addTimeSlot,
  updateTimeSlot,
  removeTimeSlot,
  toggleDayOfWeek,
  handleAddSchedule,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          Add Schedule
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="sticky top-0 bg-background z-10 p-4 border-b">
          <DialogTitle>Add Medication Schedule</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto p-4 flex-1 space-y-4">
          <div>
            <Label>Name*</Label>
            <Input
              value={scheduleForm.name}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Medication name"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={scheduleForm.description}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Additional details"
            />
          </div>

          <div>
            <Label>Prescription</Label>
            <Textarea
              value={scheduleForm.prescription}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, prescription: e.target.value }))}
              placeholder="Prescription details"
            />
          </div>

          <div>
            <Label>Schedule Type*</Label>
            <Select
              value={scheduleForm.schedule_type}
              onValueChange={(value) => setScheduleForm(prev => ({ ...prev, schedule_type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="selective">Selective Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(scheduleForm.schedule_type === 'weekly' || scheduleForm.schedule_type === 'selective') && (
            <div>
              <Label>Days of Week</Label>
              <div className="grid grid-cols-2 gap-2">
                {dayNames.map((day, index) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${index}`}
                      checked={scheduleForm.days_of_week.includes(index)}
                      onCheckedChange={() => toggleDayOfWeek(index)}
                    />
                    <Label htmlFor={`day-${index}`} className="text-sm">{day}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Scheduled Times*</Label>
            <div className="space-y-2">
              {scheduleForm.scheduled_times.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => updateTimeSlot(index, e.target.value)}
                  />
                  {scheduleForm.scheduled_times.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeTimeSlot(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addTimeSlot}>
                Add Time
              </Button>
            </div>
          </div>

          <div>
            <Label>Meal Timing</Label>
            <Select
              value={scheduleForm.meal_timing}
              onValueChange={(value) => setScheduleForm(prev => ({ ...prev, meal_timing: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before_meal">Before Meal</SelectItem>
                <SelectItem value="after_meal">After Meal</SelectItem>
                <SelectItem value="with_meal">With Meal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dosage Type</Label>
              <Select
                value={scheduleForm.dosage_type}
                onValueChange={(value) => setScheduleForm(prev => ({ ...prev, dosage_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="capsule">Capsule</SelectItem>
                  <SelectItem value="ml">ML</SelectItem>
                  <SelectItem value="drops">Drops</SelectItem>
                  <SelectItem value="units">Units</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Dosage Count</Label>
              <Input
                type="number"
                min="1"
                value={scheduleForm.dosage_count}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, dosage_count: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={scheduleForm.is_active}
              onCheckedChange={(checked) => setScheduleForm(prev => ({ ...prev, is_active: checked }))}
            />
            <Label>Active Schedule</Label>
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button onClick={handleAddSchedule} className="flex-1">
            Add Schedule
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MedicationScheduleDialog;
