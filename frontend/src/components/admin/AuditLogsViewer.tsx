import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle,
  User,
  Settings,
  Clock,
  Filter,
  Search,
  ShieldAlert,
  Sparkles,
  Activity,
  Layers3,
  RefreshCw,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  user_id: string | null;
  patient_id: string | null;
  caregiver_id: string | null;
  action: string;
  event_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  source: string | null;
  summary?: string | null;
  details?: string | null;
  severity?: string | null;
  outcome?: string | null;
  context?: Record<string, string> | null;
  changed_fields?: string[] | null;
  change_count?: number | null;
  changes?: Record<string, { old: string | null; new: string | null }> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
}

interface AuditMetadata {
  summary?: string;
  details?: string;
  severity?: string;
  outcome?: string;
  changed_fields?: string[];
  changes?: Record<string, { old: string | null; new: string | null }>;
  change_count?: number;
  context?: Record<string, string>;
}

type DatePreset =
  | "last_1h"
  | "last_3h"
  | "last_6h"
  | "last_12h"
  | "today"
  | "last_3_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

interface UserItem {
  id: string;
  full_name?: string;
  email?: string;
}

interface LogFilters {
  q: string;
  eventType: string;
  source: string;
  datePreset: DatePreset;
}

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const PAGE_SIZE = 50;

const initialFilters: LogFilters = {
  q: "",
  eventType: "all",
  source: "all",
  datePreset: "today",
};

const datePresetOptions: { value: DatePreset; label: string }[] = [
  { value: "last_1h", label: "Last 1 Hour" },
  { value: "last_3h", label: "Last 3 Hours" },
  { value: "last_6h", label: "Last 6 Hours" },
  { value: "last_12h", label: "Last 12 Hours" },
  { value: "today", label: "Today" },
  { value: "last_3_days", label: "Last 3 Days" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
];

const getDateRange = (preset: DatePreset): { from: Date; to: Date } => {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  switch (preset) {
    case "last_1h":
      from.setHours(from.getHours() - 1);
      break;
    case "last_3h":
      from.setHours(from.getHours() - 3);
      break;
    case "last_6h":
      from.setHours(from.getHours() - 6);
      break;
    case "last_12h":
      from.setHours(from.getHours() - 12);
      break;
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "last_3_days":
      from.setDate(from.getDate() - 3);
      break;
    case "this_week": {
      const day = from.getDay();
      const diff = day === 0 ? 6 : day - 1;
      from.setDate(from.getDate() - diff);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case "last_week": {
      const day = from.getDay();
      const diff = day === 0 ? 6 : day - 1;
      from.setDate(from.getDate() - diff - 7);
      from.setHours(0, 0, 0, 0);
      const end = new Date(from);
      end.setDate(end.getDate() + 7);
      return { from, to: end };
    }
    case "this_month":
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case "last_month": {
      from.setMonth(from.getMonth() - 1, 1);
      from.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: end };
    }
  }

  return { from, to };
};

const formatAction = (action: string) =>
  action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getActionIcon = (action: string) => {
  const value = action.toLowerCase();
  if (value.includes("alert") || value.includes("sos")) return <AlertCircle className="h-4.5 w-4.5" />;
  if (value.includes("user") || value.includes("login")) return <User className="h-4.5 w-4.5" />;
  return <Settings className="h-4.5 w-4.5" />;
};

const getActionVariant = (action: string): BadgeVariant => {
  const value = action.toLowerCase();
  if (value.includes("sos") || value.includes("alert")) return "destructive";
  if (value.includes("created") || value.includes("granted")) return "default";
  return "secondary";
};

const getSeverityVariant = (severity?: string | null): BadgeVariant => {
  if (severity === "critical" || severity === "high") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
};

const getMetadataView = (log: AuditLog) => {
  const meta = (log.metadata || {}) as AuditMetadata;
  const summary = log.summary || meta.summary;
  const details = log.details || meta.details;
  const severity = log.severity || meta.severity;
  const outcome = log.outcome || meta.outcome;
  const changedFields =
    (Array.isArray(log.changed_fields) ? log.changed_fields : null) ||
    (Array.isArray(meta.changed_fields) ? meta.changed_fields : []);
  const changes = log.changes ? Object.entries(log.changes) : Object.entries(meta.changes || {});
  const context = Object.entries(log.context || meta.context || {}).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== "",
  );

  return {
    summary,
    details,
    severity,
    outcome,
    changedFields,
    changes,
    context,
    isEmpty:
      !summary &&
      !details &&
      !severity &&
      !outcome &&
      changedFields.length === 0 &&
      changes.length === 0 &&
      context.length === 0,
  };
};

const StatTile = ({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}) => (
  <div
    className={`rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${accent || ""}`}
  >
    <div className="mb-3 flex items-center justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <Sparkles className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="text-2xl font-semibold tracking-tight">{value}</div>
    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
  </div>
);

const FieldLabel = ({ children }: { children: ReactNode }) => (
  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{children}</div>
);

const MetadataBlock = ({ log }: { log: AuditLog }) => {
  const { summary, details, severity, outcome, changedFields, changes, context, isEmpty } = getMetadataView(log);

  if (isEmpty) return null;

  return (
    <div className="mt-3 rounded-2xl border border-border/60 bg-muted/25 p-3">
      {(severity || outcome) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {severity && (
            <Badge variant={getSeverityVariant(severity)} className="rounded-full px-2.5 py-0.5 text-[10px] capitalize">
              {severity}
            </Badge>
          )}
          {outcome && (
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px]">
              {outcome}
            </Badge>
          )}
        </div>
      )}

      <div className="space-y-2">
        {summary && <p className="text-[12px] font-medium text-foreground/95">{summary}</p>}
        {details && <p className="text-[11px] leading-5 text-muted-foreground">{details}</p>}

        {context.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {context.slice(0, 4).map(([key, value]) => (
              <div
                key={key}
                className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] text-muted-foreground"
              >
                <span className="font-medium text-foreground/80">{key}:</span> {String(value)}
              </div>
            ))}
          </div>
        )}

        {changedFields.length > 0 && (
          <div className="rounded-xl bg-background/60 px-2.5 py-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Changed:</span> {changedFields.join(", ")}
          </div>
        )}

        {changes.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {changes.slice(0, 4).map(([field, value]) => (
              <div key={field} className="rounded-xl border border-border/60 bg-background/70 px-2.5 py-2 text-[11px]">
                <p className="mb-1 font-medium text-foreground/85">{field}</p>
                <p className="break-words text-muted-foreground">
                  {String(value?.old ?? "null")} <span className="mx-1">→</span> {String(value?.new ?? "null")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const InfoLine = ({ label, value }: { label: string; value: string | null }) => {
  if (!value) return null;

  return (
    <div className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] text-muted-foreground">
      <span className="font-medium text-foreground/85">{label}:</span> {value}
    </div>
  );
};

const AuditLogRow = ({
  log,
  getUserLabel,
}: {
  log: AuditLog;
  getUserLabel: (id?: string | null) => string | null;
}) => {
  const actor = getUserLabel(log.user_id);
  const patient = getUserLabel(log.patient_id);
  const caregiver = getUserLabel(log.caregiver_id);
  const meta = getMetadataView(log);
  const severity = meta.severity;
  const hasAlert = severity === "critical" || severity === "high" || log.action.toLowerCase().includes("alert");
  const compactSummary = meta.summary || meta.details || "No additional summary available";

  return (
    <div className="group relative pl-14">
      <div className="absolute left-[21px] top-0 h-full w-px bg-border" />

      <div
        className={`absolute left-0 top-5 flex h-10 w-10 items-center justify-center rounded-2xl border shadow-sm transition-all duration-300 group-hover:scale-110 ${
          hasAlert
            ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
            : "border-border/60 bg-background text-primary"
        }`}
      >
        {getActionIcon(log.action)}
      </div>

      <div className="mb-4 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.015] hover:shadow-lg">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={getActionVariant(log.action)} className="rounded-full px-3 py-1 text-[10px]">
                {formatAction(log.action)}
              </Badge>

              {log.event_type && (
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px]">
                  {log.event_type}
                </Badge>
              )}

              {log.source && (
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px]">
                  {log.source}
                </Badge>
              )}

              {severity && (
                <Badge variant={getSeverityVariant(severity)} className="rounded-full px-3 py-1 text-[10px] capitalize">
                  {severity}
                </Badge>
              )}
            </div>

            <p className="line-clamp-2 text-[13px] leading-6 text-foreground/90">{compactSummary}</p>

            <div className="mt-3 max-h-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:mt-4 group-hover:max-h-[420px] group-hover:opacity-100">
              <div className="flex flex-wrap gap-1.5">
                <InfoLine label="Done By" value={actor} />
                <InfoLine label="Patient" value={patient} />
                <InfoLine label="Caregiver" value={caregiver} />
                <InfoLine label="IP" value={log.ip_address} />
                <InfoLine label="Entity" value={log.entity_type} />
                <InfoLine label="Entity ID" value={log.entity_id} />
              </div>

              <MetadataBlock log={log} />
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{new Date(log.created_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AuditLogsViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<LogFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.q.trim()), 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const updateFilter = useCallback(<K extends keyof LogFilters>(key: K, value: LogFilters[K]) => {
    setLimit(PAGE_SIZE);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const users = (await api.get("/users")) as UserItem[];
      const nextMap = (Array.isArray(users) ? users : []).reduce<Record<string, string>>((acc, user) => {
        const userId = (user.id || (user as { _id?: string })._id || "").toString();
        if (!userId) return acc;
        acc[userId] = user.full_name || user.email || `User ${userId.slice(0, 8)}`;
        return acc;
      }, {});
      setUsersMap(nextMap);
    } catch {
      setUsersMap({});
    }
  }, []);

  const loadLogs = useCallback(
    async (appliedFilters: LogFilters, appliedLimit: number, searchTerm: string) => {
      try {
        const params = new URLSearchParams();
        const { from, to } = getDateRange(appliedFilters.datePreset);

        params.set("limit", String(appliedLimit));
        params.set("dateFrom", from.toISOString());
        params.set("dateTo", to.toISOString());

        if (searchTerm) params.set("q", searchTerm);
        if (appliedFilters.eventType !== "all") params.set("eventType", appliedFilters.eventType);
        if (appliedFilters.source !== "all") params.set("source", appliedFilters.source);

        const data = (await api.get(`/audit-logs?${params.toString()}`)) as AuditLog[];
        const nextLogs = Array.isArray(data) ? data : [];

        setLogs(nextLogs);
        setHasMore(nextLogs.length >= appliedLimit);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load audit logs",
          variant: "destructive",
        });
        setLogs([]);
        setHasMore(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setLoading(true);
    loadLogs(filters, limit, debouncedSearch).finally(() => {
      setLoading(false);
      setLoadingMore(false);
    });
  }, [filters.eventType, filters.source, filters.datePreset, debouncedSearch, limit, loadLogs]);

  const uniqueEventTypes = useMemo(
    () => Array.from(new Set(logs.map((log) => log.event_type).filter(Boolean))) as string[],
    [logs],
  );

  const uniqueSources = useMemo(
    () => Array.from(new Set(logs.map((log) => log.source).filter(Boolean))) as string[],
    [logs],
  );

  const getUserLabel = useCallback(
    (userId?: string | null) => {
      if (!userId) return null;
      return usersMap[userId] || "Unknown user";
    },
    [usersMap],
  );

  const currentDatePresetLabel = useMemo(
    () => datePresetOptions.find((item) => item.value === filters.datePreset)?.label || "Today",
    [filters.datePreset],
  );

  const stats = useMemo(() => {
    const criticalCount = logs.filter((log) => {
      const severity = log.severity || ((log.metadata || {}) as AuditMetadata)?.severity;
      return severity === "critical" || severity === "high";
    }).length;

    const actorCount = new Set(logs.map((log) => log.user_id).filter(Boolean)).size;
    const sourceCount = new Set(logs.map((log) => log.source).filter(Boolean)).size;

    return {
      total: logs.length,
      critical: criticalCount,
      actors: actorCount,
      sources: sourceCount,
    };
  }, [logs]);

  const handleResetFilters = () => {
    setFilters(initialFilters);
    setDebouncedSearch("");
    setLimit(PAGE_SIZE);
  };

  const handleShowMore = () => {
    setLoadingMore(true);
    setLimit((prev) => prev + PAGE_SIZE);
  };

  return (
    <div className="space-y-4">
      <Card className="care-card overflow-hidden border-border/60 shadow-sm">
        <CardContent className="relative p-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-background to-background" />
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />

          <div className="relative p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  <Activity className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full bg-background/70 px-2.5 py-1 text-[10px]">
                      Audit Intelligence
                    </Badge>
                    <Badge variant="outline" className="rounded-full bg-background/70 px-2.5 py-1 text-[10px]">
                      {currentDatePresetLabel}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Audit Activity Center</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    A more visual stream of system activity with fast filters, quick insights, and a timeline-based audit reading experience.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
                <StatTile icon={<FileText className="h-5 w-5" />} label="Visible events" value={stats.total} />
                <StatTile icon={<ShieldAlert className="h-5 w-5" />} label="Critical / high" value={stats.critical} />
                <StatTile icon={<User className="h-5 w-5" />} label="Unique actors" value={stats.actors} />
                <StatTile icon={<Layers3 className="h-5 w-5" />} label="Sources" value={stats.sources} />
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-background/75 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Smart Filters</p>
                  <p className="text-[11px] text-muted-foreground">Focus on the exact slice of activity you want to inspect.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
                <div className="md:col-span-2 xl:col-span-5">
                  <FieldLabel>Search</FieldLabel>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-11 rounded-2xl pl-10"
                      placeholder="Search logs, action, summary, source, user..."
                      value={filters.q}
                      onChange={(e) => updateFilter("q", e.target.value)}
                    />
                  </div>
                </div>

                <div className="xl:col-span-2">
                  <FieldLabel>Event Type</FieldLabel>
                  <Select value={filters.eventType} onValueChange={(value) => updateFilter("eventType", value)}>
                    <SelectTrigger className="h-11 rounded-2xl">
                      <SelectValue placeholder="Event Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Event Types</SelectItem>
                      {uniqueEventTypes.map((eventType) => (
                        <SelectItem key={eventType} value={eventType}>
                          {eventType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="xl:col-span-2">
                  <FieldLabel>Source</FieldLabel>
                  <Select value={filters.source} onValueChange={(value) => updateFilter("source", value)}>
                    <SelectTrigger className="h-11 rounded-2xl">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {uniqueSources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="xl:col-span-2">
                  <FieldLabel>Date Range</FieldLabel>
                  <Select
                    value={filters.datePreset}
                    onValueChange={(value) => updateFilter("datePreset", value as DatePreset)}
                  >
                    <SelectTrigger className="h-11 rounded-2xl">
                      <SelectValue placeholder="Date Range" />
                    </SelectTrigger>
                    <SelectContent>
                      {datePresetOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 xl:col-span-1">
                  <FieldLabel>Actions</FieldLabel>
                  <Button variant="outline" className="h-11 w-full rounded-2xl" onClick={handleResetFilters}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="care-card overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading ? "Loading events..." : `${logs.length} event${logs.length === 1 ? "" : "s"} in the current view`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                Period: {currentDatePresetLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                Sources: {stats.sources}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                Actors: {stats.actors}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[700px]">
            {loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Loading audit logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No audit logs found</p>
                <p className="mt-1 text-sm text-muted-foreground">Try changing the date range, source, or search keywords.</p>
              </div>
            ) : (
              <div className="p-5">
                {logs.map((log) => (
                  <AuditLogRow key={log.id} log={log} getUserLabel={getUserLabel} />
                ))}
              </div>
            )}
          </ScrollArea>

          {!loading && hasMore && (
            <div className="border-t border-border/60 bg-background/90 p-4 backdrop-blur-sm">
              <Button onClick={handleShowMore} disabled={loadingMore} variant="outline" className="h-11 w-full rounded-2xl">
                {loadingMore ? "Loading..." : "Show More Events"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogsViewer;