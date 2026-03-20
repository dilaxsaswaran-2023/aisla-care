import { useMemo } from "react";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MedicationMonitorItem } from "@/components/caregiver/medication/MedicationShared";

type CalendarMode = "day" | "week";

interface MedicationCalendarViewProps {
  patientName?: string;
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  referenceDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  dayItems: MedicationMonitorItem[];
  weekItemsByDate: Record<string, MedicationMonitorItem[]>;
  loading: boolean;
}

type CalendarEvent = {
  id: string;
  minutes: number;
  overlapIndex: number;
  overlapCount: number;
  status: MedicationMonitorItem["status"];
  medicationName: string;
  urgencyLevel: string;
  timeLabel: string;
  description?: string;
};

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const HOUR_HEIGHT_PX = 48;
const DAY_HEIGHT_PX = HOURS.length * HOUR_HEIGHT_PX;
const MINUTE_HEIGHT_PX = HOUR_HEIGHT_PX / 60;
const WEEK_GRID_COLUMNS = "72px repeat(7, minmax(110px, 1fr))";

const STATUS_STYLES: Record<
  MedicationMonitorItem["status"],
  {
    card: string;
    pill: string;
    dot: string;
  }
> = {
  pending: {
    card: "border-sky-300/80 bg-sky-100/90 text-sky-950 shadow-[0_8px_24px_-14px_rgba(14,165,233,0.45)]",
    pill: "bg-sky-100 text-sky-800 border border-sky-300/70",
    dot: "bg-sky-500",
  },
  taken: {
    card: "border-emerald-300/80 bg-emerald-100/90 text-emerald-950 shadow-[0_8px_24px_-14px_rgba(16,185,129,0.45)]",
    pill: "bg-emerald-100 text-emerald-800 border border-emerald-300/70",
    dot: "bg-emerald-500",
  },
  missed: {
    card: "border-rose-300/80 bg-rose-100/90 text-rose-950 shadow-[0_8px_24px_-14px_rgba(244,63,94,0.45)]",
    pill: "bg-rose-100 text-rose-800 border border-rose-300/70",
    dot: "bg-rose-500",
  },
};

const URGENCY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 border border-slate-300/70",
  medium: "bg-amber-100 text-amber-800 border border-amber-300/70",
  high: "bg-orange-100 text-orange-800 border border-orange-300/70",
  critical: "bg-red-100 text-red-800 border border-red-300/70",
};

const toDateKey = (date: Date): string => format(date, "yyyy-MM-dd");

const toHourLabel = (hour: number): string => {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${String(normalized).padStart(2, "0")}:00 ${suffix}`;
};

const parseTimeToMinutes = (value?: string): number | null => {
  if (!value) return null;
  const [rawHour, rawMinute] = String(value).split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
};

const toEventDate = (item: MedicationMonitorItem, fallbackDate: Date): Date | null => {
  if (item.scheduled_for_at) {
    const parsed = parseISO(item.scheduled_for_at);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const minutes = parseTimeToMinutes(item.time);
  if (minutes === null) return null;

  const date = new Date(fallbackDate);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
};

const buildDayEvents = (items: MedicationMonitorItem[], fallbackDate: Date): CalendarEvent[] => {
  const sorted = [...items]
    .map((item, index) => {
      const date = toEventDate(item, fallbackDate);
      if (!date) return null;

      const minutes = date.getHours() * 60 + date.getMinutes();
      return {
        id: `${item.schedule_id}-${item.monitor_id || index}-${item.time}`,
        minutes,
        status: item.status,
        medicationName: item.medication_name,
        urgencyLevel: item.urgency_level || "medium",
        timeLabel: item.time,
        description: item.description,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left!.minutes - right!.minutes) as Array<{
    id: string;
    minutes: number;
    status: MedicationMonitorItem["status"];
    medicationName: string;
    urgencyLevel: string;
    timeLabel: string;
    description?: string;
  }>;

  const grouped = sorted.reduce<Record<number, typeof sorted>>((acc, event) => {
    if (!acc[event.minutes]) acc[event.minutes] = [];
    acc[event.minutes].push(event);
    return acc;
  }, {});

  const events: CalendarEvent[] = [];
  Object.values(grouped).forEach((group) => {
    group.forEach((event, overlapIndex) => {
      events.push({
        ...event,
        overlapIndex,
        overlapCount: group.length,
      });
    });
  });

  return events;
};

const getNowLinePosition = (): number => {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) * MINUTE_HEIGHT_PX;
};

const renderHourMarkers = () =>
  HOURS.map((hour) => (
    <div
      key={`hour-label-${hour}`}
      className="absolute left-2 text-[11px] font-medium text-muted-foreground"
      style={{ top: `${hour * HOUR_HEIGHT_PX - 8}px` }}
    >
      {toHourLabel(hour)}
    </div>
  ));

const renderHourLines = () =>
  HOURS.map((hour) => (
    <div
      key={`hour-line-${hour}`}
      className="absolute inset-x-0 border-t border-border/70"
      style={{ top: `${hour * HOUR_HEIGHT_PX}px` }}
    />
  ));

const renderHalfHourLines = () =>
  HOURS.map((hour) => (
    <div
      key={`half-hour-line-${hour}`}
      className="absolute inset-x-0 border-t border-dashed border-border/40"
      style={{ top: `${hour * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2}px` }}
    />
  ));

const renderNowLine = () => (
  <div
    className="absolute inset-x-0 z-20"
    style={{ top: `${getNowLinePosition()}px` }}
  >
    <div className="relative flex items-center">
      <div className="absolute -left-1.5 h-3 w-3 rounded-full border-2 border-background bg-rose-500 shadow-sm" />
      <div className="h-[2px] w-full bg-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.15)]" />
    </div>
  </div>
);

const renderEventBlock = (event: CalendarEvent) => {
  const widthPercent = 100 / event.overlapCount;
  const leftPercent = event.overlapIndex * widthPercent;
  const statusStyle = STATUS_STYLES[event.status];
  const urgencyStyle = URGENCY_STYLES[event.urgencyLevel.toLowerCase()] || URGENCY_STYLES.medium;

  return (
    <div
      key={event.id}
      className={cn(
        "absolute z-10 overflow-hidden rounded-xl border px-2 py-1.5 shadow-sm transition-all duration-200 hover:z-30 hover:scale-[1.015] hover:shadow-md",
        "text-[10px] leading-tight backdrop-blur-sm",
        statusStyle.card,
      )}
      style={{
        top: `${event.minutes * MINUTE_HEIGHT_PX + 3}px`,
        left: `calc(${leftPercent}% + 3px)`,
        width: `calc(${widthPercent}% - 6px)`,
        minHeight: "26px",
      }}
      title={`${event.medicationName} (${event.timeLabel})`}
    >
      <div className="flex items-start gap-1.5">
        <div className={cn("mt-1 h-2 w-2 flex-shrink-0 rounded-full", statusStyle.dot)} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{event.medicationName}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-medium">
              {event.timeLabel}
            </span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", urgencyStyle)}>
              {event.urgencyLevel.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryChip = ({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) => (
  <div className={cn("rounded-2xl border px-3 py-2 shadow-sm", className)}>
    <div className="text-base font-semibold">{value}</div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
  </div>
);

export const MedicationCalendarView = ({
  patientName,
  mode,
  onModeChange,
  referenceDate,
  onPrevious,
  onNext,
  onToday,
  dayItems,
  weekItemsByDate,
  loading,
}: MedicationCalendarViewProps) => {
  const weekDates = useMemo(() => {
    const start = startOfWeek(referenceDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [referenceDate]);

  const dayEvents = useMemo(() => buildDayEvents(dayItems, referenceDate), [dayItems, referenceDate]);

  const weekEventsByDate = useMemo(() => {
    return weekDates.reduce<Record<string, CalendarEvent[]>>((acc, date) => {
      const key = toDateKey(date);
      acc[key] = buildDayEvents(weekItemsByDate[key] || [], date);
      return acc;
    }, {});
  }, [weekDates, weekItemsByDate]);

  const rangeLabel = useMemo(() => {
    if (mode === "day") return format(referenceDate, "EEEE, MMM d, yyyy");
    const start = weekDates[0];
    const end = weekDates[6];
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
  }, [mode, referenceDate, weekDates]);

  const summary = useMemo(() => {
    const sourceItems =
      mode === "day"
        ? dayItems
        : Object.values(weekItemsByDate).flat();

    return sourceItems.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        return acc;
      },
      { total: 0, pending: 0, taken: 0, missed: 0 },
    );
  }, [mode, dayItems, weekItemsByDate]);

  return (
    <Card className="care-card overflow-hidden border-border/70 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.2)]">
      <CardHeader className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-background pb-4">
        <div className="absolute -right-12 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-10 top-6 h-16 w-16 rounded-full bg-sky-500/10 blur-2xl" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <span>Medication Calendar{patientName ? ` - ${patientName}` : ""}</span>
              </CardTitle>
              <CardDescription className="mt-1">
                Timeline-based medication monitoring with daily and weekly planning views
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Tabs value={mode} onValueChange={(value) => onModeChange(value as CalendarMode)}>
                <TabsList className="h-10 rounded-2xl border border-border/60 bg-background/80 p-1 shadow-sm">
                  <TabsTrigger
                    value="day"
                    className="rounded-xl px-4 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                  >
                    Day
                  </TabsTrigger>
                  <TabsTrigger
                    value="week"
                    className="rounded-xl px-4 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                  >
                    Week
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Badge variant="outline" className="h-10 rounded-2xl border-border/60 bg-background/80 px-4 text-xs shadow-sm">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {rangeLabel}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 shadow-sm" onClick={onPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 shadow-sm" onClick={onNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-xl px-4 text-xs shadow-sm" onClick={onToday}>
                Today
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryChip
                label="Total"
                value={summary.total}
                className="border-border/60 bg-background/85"
              />
              <SummaryChip
                label="Pending"
                value={summary.pending}
                className="border-sky-300/60 bg-sky-50/80"
              />
              <SummaryChip
                label="Taken"
                value={summary.taken}
                className="border-emerald-300/60 bg-emerald-50/80"
              />
              <SummaryChip
                label="Missed"
                value={summary.missed}
                className="border-rose-300/60 bg-rose-50/80"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge className={cn("rounded-full px-3 py-1 text-[11px]", STATUS_STYLES.pending.pill)}>
              Pending
            </Badge>
            <Badge className={cn("rounded-full px-3 py-1 text-[11px]", STATUS_STYLES.taken.pill)}>
              Taken
            </Badge>
            <Badge className={cn("rounded-full px-3 py-1 text-[11px]", STATUS_STYLES.missed.pill)}>
              Missed
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
              <Clock3 className="mr-1.5 h-3.5 w-3.5" />
              Live time marker shown for today
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-10 text-center text-sm text-muted-foreground">
            Loading calendar...
          </div>
        ) : mode === "day" ? (
          <div className="max-h-[460px] overflow-auto rounded-2xl border border-border/70 bg-background shadow-sm">
            <div className="min-w-[620px]">
              <div
                className="grid border-b border-border/60 bg-gradient-to-r from-muted/30 via-background to-background"
                style={{ gridTemplateColumns: "72px 1fr" }}
              >
                <div className="px-3 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Time
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">{format(referenceDate, "EEEE, MMM d")}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {dayEvents.length} scheduled item{dayEvents.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {isSameDay(referenceDate, new Date()) ? (
                    <Badge className="rounded-full bg-primary/10 text-primary border border-primary/20">
                      Today
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: "72px 1fr" }}>
                <div className="relative border-r border-border/60 bg-muted/15" style={{ height: `${DAY_HEIGHT_PX}px` }}>
                  {renderHourMarkers()}
                </div>

                <div
                  className="relative bg-[linear-gradient(to_bottom,transparent,transparent)]"
                  style={{ height: `${DAY_HEIGHT_PX}px` }}
                >
                  {renderHourLines()}
                  {renderHalfHourLines()}
                  {isSameDay(referenceDate, new Date()) ? renderNowLine() : null}
                  {dayEvents.map((event) => renderEventBlock(event))}
                  {dayEvents.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                      No medications scheduled for this day.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[460px] overflow-auto rounded-2xl border border-border/70 bg-background shadow-sm">
            <div className="min-w-[920px]">
              <div
                className="sticky top-0 z-20 grid border-b border-border/60 bg-background/95 backdrop-blur-md"
                style={{ gridTemplateColumns: WEEK_GRID_COLUMNS }}
              >
                <div className="px-3 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Time
                </div>

                {weekDates.map((day) => {
                  const key = toDateKey(day);
                  const count = (weekEventsByDate[key] || []).length;
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={key}
                      className={cn(
                        "border-l border-border/60 px-3 py-3 transition-colors",
                        isToday && "bg-primary/[0.08]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold">{format(day, "EEE")}</p>
                          <p className="text-[11px] text-muted-foreground">{format(day, "MMM d")}</p>
                        </div>
                        {isToday ? (
                          <Badge className="rounded-full bg-primary/10 text-primary border border-primary/20">
                            Today
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        {count} item{count === 1 ? "" : "s"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid" style={{ gridTemplateColumns: WEEK_GRID_COLUMNS }}>
                <div className="relative border-r border-border/60 bg-muted/15" style={{ height: `${DAY_HEIGHT_PX}px` }}>
                  {renderHourMarkers()}
                </div>

                {weekDates.map((day) => {
                  const key = toDateKey(day);
                  const events = weekEventsByDate[key] || [];
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={`column-${key}`}
                      className={cn(
                        "relative border-r border-border/60 last:border-r-0",
                        isToday && "bg-primary/[0.03]",
                      )}
                      style={{ height: `${DAY_HEIGHT_PX}px` }}
                    >
                      {renderHourLines()}
                      {renderHalfHourLines()}
                      {isToday ? renderNowLine() : null}
                      {events.map((event) => renderEventBlock(event))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MedicationCalendarView;
