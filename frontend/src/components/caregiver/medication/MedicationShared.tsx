import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Bell, Edit, Pill, Power, RefreshCw } from "lucide-react";

export interface MedicationScheduleItem {
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
}

export interface MedicationMonitorItem {
  schedule_id: string;
  medication_name: string;
  description?: string;
  urgency_level: string;
  time: string;
  scheduled_for_at?: string;
  due_at?: string;
  status: "pending" | "taken" | "missed";
  taken_at?: string;
  monitor_id?: string;
  can_mark_done: boolean;
}

const formatTimeT = (value?: string): string => {
  if (!value || !value.includes("T")) return value || "--";
  return value.split("T")[1].slice(0, 5);
};

interface MedicationFlowCardProps {
  items: MedicationMonitorItem[];
  loading: boolean;
  onRefresh?: () => void;
  title?: string;
  countLabel?: string;
  emptyLabel?: string;
  loadingLabel?: string;
  className?: string;
}

export const MedicationFlowCard = ({
  items,
  loading,
  onRefresh,
  title = "Today's Medication Flow",
  countLabel,
  emptyLabel = "No medication scheduled for today",
  loadingLabel = "Loading...",
  className,
}: MedicationFlowCardProps) => {
  return (
    <Card className={className || "rounded-[28px] border shadow-sm"}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            {title}
            <Badge variant="secondary" className="rounded-lg">{items.length}</Badge>
          </CardTitle>

          {onRefresh ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="rounded-xl h-8 px-2.5"
              title={countLabel || "Refresh medication status"}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            {loadingLabel}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="space-y-2 max-h-[780px] overflow-auto pr-1">
            {items.map((item, index) => {
              const key = `${item.schedule_id}-${item.time}-${item.monitor_id || index}`;
              const isDone = item.status === "taken";
              const isMissed = item.status === "missed";
              const statusVariant = isDone ? "default" : isMissed ? "destructive" : "secondary";
              const isLast = index === items.length - 1;
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
                              variant={item.urgency_level === "high" ? "destructive" : item.urgency_level === "low" ? "secondary" : "default"}
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

                    {(item.scheduled_for_at || item.due_at || item.taken_at) ? (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        {item.scheduled_for_at ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="text-muted-foreground">Scheduled</span>
                            <span className="font-medium">{formatTimeT(item.scheduled_for_at)}</span>
                          </div>
                        ) : null}

                        {item.due_at ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="text-muted-foreground">Due</span>
                            <span className="font-medium">{formatTimeT(item.due_at)}</span>
                          </div>
                        ) : null}

                        {item.taken_at ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="text-muted-foreground">Taken</span>
                            <span className="font-medium text-green-600">{formatTimeT(item.taken_at)}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface MedicationSchedulesCardProps {
  schedules: MedicationScheduleItem[];
  dayNames: string[];
  title?: string;
  actionNode?: ReactNode;
  className?: string;
  onEdit?: (schedule: MedicationScheduleItem) => void;
  onToggleActive?: (scheduleId: string) => void;
}

export const MedicationSchedulesCard = ({
  schedules,
  dayNames,
  title = "Medication Schedules",
  actionNode,
  className,
  onEdit,
  onToggleActive,
}: MedicationSchedulesCardProps) => {
  return (
    <Card className={className || "rounded-[28px] border shadow-sm"}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <Pill className="w-4 h-4" />
            </div>
            {title}
            <Badge variant="secondary" className="rounded-lg">{schedules.length}</Badge>
          </CardTitle>

          {actionNode || null}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {schedules.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No medication schedules
          </div>
        ) : (
          <div className="space-y-2 max-h-[780px] overflow-auto pr-1">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-2xl border bg-background p-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{schedule.name}</h3>
                      <Badge
                        variant={schedule.urgency_level === "high" ? "destructive" : schedule.urgency_level === "low" ? "secondary" : "default"}
                        className="text-[10px] rounded-lg"
                      >
                        {schedule.urgency_level ? schedule.urgency_level.toUpperCase() : "MEDIUM"}
                      </Badge>
                      <Badge variant={schedule.is_active ? "default" : "secondary"} className="text-[10px] rounded-lg">
                        {schedule.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {schedule.description ? (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{schedule.description}</p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <div className="rounded-xl bg-muted/40 px-2 py-1 text-[11px]">
                        <span className="text-muted-foreground mr-1">Time</span>
                        <span className="font-medium">{(schedule.scheduled_times || []).join(", ") || "--"}</span>
                      </div>
                      <div className="rounded-xl bg-muted/40 px-2 py-1 text-[11px]">
                        <span className="text-muted-foreground mr-1">Type</span>
                        <span className="font-medium capitalize">{schedule.schedule_type}</span>
                      </div>
                      <div className="rounded-xl bg-muted/40 px-2 py-1 text-[11px]">
                        <span className="text-muted-foreground mr-1">Grace</span>
                        <span className="font-medium">{schedule.grace_period_minutes || 0}m</span>
                      </div>
                      {schedule.dosage_type ? (
                        <div className="rounded-xl bg-muted/40 px-2 py-1 text-[11px]">
                          <span className="text-muted-foreground mr-1">Dose</span>
                          <span className="font-medium">{schedule.dosage_count || 1} {schedule.dosage_type}</span>
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

                  {onEdit || onToggleActive ? (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {onEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(schedule)}
                          className="rounded-xl h-8 px-3 text-xs justify-start"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                      ) : null}
                      {onToggleActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleActive(schedule.id)}
                          className="rounded-xl h-8 px-3 text-xs justify-start"
                        >
                          <Power className={`w-3.5 h-3.5 mr-1 ${schedule.is_active ? "" : "text-muted-foreground"}`} />
                          {schedule.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface MedicationScheduleSummaryCardProps {
  patientName: string;
  schedules: MedicationScheduleItem[];
  loading: boolean;
  className?: string;
}

export const MedicationScheduleSummaryCard = ({
  patientName,
  schedules,
  loading,
  className,
}: MedicationScheduleSummaryCardProps) => {
  return (
    <Card className={className || "care-card"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Pill className="w-4 h-4" />
          Medication Schedules{patientName ? ` - ${patientName}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading schedules...</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medication schedules found.</p>
        ) : (
          schedules.map((s) => (
            <div key={s.id} className="border rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm truncate">{s.name}</p>
                <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge>
              </div>
              {s.description ? <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p> : null}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="w-3.5 h-3.5" />
                {(s.scheduled_times || []).join(", ") || "No times"}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
