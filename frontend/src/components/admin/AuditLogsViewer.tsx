import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  FileText,
  Filter,
  Layers3,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AuditLog,
  AuditMetadata,
  DatePreset,
  LogFilters,
  PAGE_SIZE,
  UserItem,
  datePresetOptions,
  getDateRange,
  initialFilters,
} from "./audit-log.utils";
import { TimelineCard } from "./audit-timeline-card";

const StatTile = ({
  icon,
  label,
  value,
  tint,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tint: string;
}) => (
  <div className={`rounded-2xl border border-border/60 bg-gradient-to-br ${tint} p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md`}>
    <div className="mb-3 flex items-center justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/80 text-primary shadow-sm">
        {icon}
      </div>
      <Sparkles className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="text-2xl font-semibold tracking-tight">{value}</div>
    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
  </div>
);

const FieldLabel = ({ children }: { children: ReactNode }) => (
  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{children}</div>
);

const AuditLogsViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<LogFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.q.trim()), 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const updateFilter = useCallback(<K extends keyof LogFilters>(key: K, value: LogFilters[K]) => {
    setLimit(PAGE_SIZE);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
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
    setExpandedId(null);
  };

  const handleShowMore = () => {
    setLoadingMore(true);
    setLimit((prev) => prev + PAGE_SIZE);
  };

  return (
    <div className="space-y-4">
      <Card className="care-card overflow-hidden border-border/60 shadow-sm">
        <CardContent className="relative p-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-background" />
          <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute left-10 top-10 h-24 w-24 rounded-full bg-sky-500/15 blur-2xl" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_40px_-16px_rgba(99,102,241,0.65)]">
                  <Activity className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full bg-background/80 px-2.5 py-1 text-[10px] shadow-sm">
                      Audit Intelligence
                    </Badge>
                    <Badge variant="outline" className="rounded-full bg-background/80 px-2.5 py-1 text-[10px] shadow-sm">
                      {currentDatePresetLabel}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Audit Activity Center</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    A standard audit dashboard with clearer KPI cards, stronger visual depth, and a centered timeline with alternating event cards.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
                <StatTile
                  icon={<FileText className="h-5 w-5" />}
                  label="Visible events"
                  value={stats.total}
                  tint="from-violet-500/15 via-violet-500/5 to-background"
                />
                <StatTile
                  icon={<ShieldAlert className="h-5 w-5" />}
                  label="Critical / high"
                  value={stats.critical}
                  tint="from-red-500/15 via-red-500/5 to-background"
                />
                <StatTile
                  icon={<User className="h-5 w-5" />}
                  label="Unique actors"
                  value={stats.actors}
                  tint="from-sky-500/15 via-sky-500/5 to-background"
                />
                <StatTile
                  icon={<Layers3 className="h-5 w-5" />}
                  label="Sources"
                  value={stats.sources}
                  tint="from-emerald-500/15 via-emerald-500/5 to-background"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-xl">
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
                      className="h-11 rounded-2xl border-border/60 bg-background/90 pl-10 shadow-sm"
                      placeholder="Search logs, action, summary, source, user..."
                      value={filters.q}
                      onChange={(e) => updateFilter("q", e.target.value)}
                    />
                  </div>
                </div>

                <div className="xl:col-span-2">
                  <FieldLabel>Event Type</FieldLabel>
                  <Select value={filters.eventType} onValueChange={(value) => updateFilter("eventType", value)}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-background/90 shadow-sm">
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
                    <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-background/90 shadow-sm">
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
                    <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-background/90 shadow-sm">
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
                  <Button variant="outline" className="h-11 w-full rounded-2xl border-border/60 bg-background/90 shadow-sm" onClick={handleResetFilters}>
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
        <CardHeader className="border-b border-border/60 bg-gradient-to-r from-background via-primary/5 to-background pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading ? "Loading events..." : `${logs.length} event${logs.length === 1 ? "" : "s"} in the current view`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1 text-[11px] shadow-sm">
                Period: {currentDatePresetLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1 text-[11px] shadow-sm">
                Sources: {stats.sources}
              </Badge>
              <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1 text-[11px] shadow-sm">
                Actors: {stats.actors}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[760px]">
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
              <div className="relative overflow-hidden p-5 md:px-8 md:py-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_35%),linear-gradient(to_bottom,transparent,rgba(99,102,241,0.03),transparent)]" />
                <div className="absolute bottom-0 left-1/2 top-0 hidden w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-transparent via-primary/45 to-transparent md:block" />

                <div className="relative -space-y-10">
                  {logs.map((log, index) => (
                    <TimelineCard
                      key={log.id}
                      log={log}
                      index={index}
                      expanded={expandedId === log.id}
                      onToggle={toggleExpanded}
                      getUserLabel={getUserLabel}
                    />
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>

          {!loading && hasMore && (
            <div className="border-t border-border/60 bg-background/90 p-4 backdrop-blur-sm">
              <Button onClick={handleShowMore} disabled={loadingMore} variant="outline" className="h-11 w-full rounded-2xl border-border/60 bg-background/90 shadow-sm">
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