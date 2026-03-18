import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, AlertCircle, User, Settings, Clock, Filter } from "lucide-react";
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
  metadata: any;
  created_at: string;
  ip_address: string | null;
}

interface AuditMetadata {
  summary?: string;
  changed_fields?: string[];
  changes?: Record<string, { old: string | null; new: string | null }>;
  change_count?: number;
  context?: Record<string, string>;
}

interface LogFilters {
  userId: string;
  patientId: string;
  caregiverId: string;
  eventType: string;
  source: string;
  dateFrom: string;
  dateTo: string;
}

const initialFilters: LogFilters = {
  userId: "",
  patientId: "",
  caregiverId: "",
  eventType: "all",
  source: "all",
  dateFrom: "",
  dateTo: "",
};

const AuditLogsViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LogFilters>(initialFilters);
  const { toast } = useToast();

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async (appliedFilters: LogFilters = filters) => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "500");
      if (appliedFilters.userId.trim()) params.set("userId", appliedFilters.userId.trim());
      if (appliedFilters.patientId.trim()) params.set("patientId", appliedFilters.patientId.trim());
      if (appliedFilters.caregiverId.trim()) params.set("caregiverId", appliedFilters.caregiverId.trim());
      if (appliedFilters.eventType !== "all") params.set("eventType", appliedFilters.eventType);
      if (appliedFilters.source !== "all") params.set("source", appliedFilters.source);
      if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
      if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);

      const data = await api.get(`/audit-logs?${params.toString()}`) as AuditLog[];
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Error", description: "Failed to load audit logs", variant: "destructive" });
      setLogs([]);
    }
    setLoading(false);
  };

  const uniqueEventTypes = Array.from(new Set(logs.map((log) => log.event_type).filter(Boolean))) as string[];
  const uniqueSources = Array.from(new Set(logs.map((log) => log.source).filter(Boolean))) as string[];

  const handleApplyFilters = () => {
    setLoading(true);
    loadLogs(filters);
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
    setLoading(true);
    loadLogs(initialFilters);
  };

  const getActionIcon = (action: string) => {
    if (action.includes('alert') || action.includes('sos')) return <AlertCircle className="w-4 h-4" />;
    if (action.includes('user') || action.includes('login')) return <User className="w-4 h-4" />;
    return <Settings className="w-4 h-4" />;
  };

  const getActionVariant = (action: string): any => {
    if (action.includes('sos') || action.includes('alert')) return 'destructive';
    if (action.includes('created') || action.includes('granted')) return 'default';
    return 'secondary';
  };

  const formatAction = (action: string) => action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const renderMetadata = (metadata: any) => {
    const m = (metadata || {}) as AuditMetadata;
    const changedFields = Array.isArray(m.changed_fields) ? m.changed_fields : [];
    const entries = m.changes ? Object.entries(m.changes) : [];

    if (!m.summary && changedFields.length === 0 && entries.length === 0) {
      return null;
    }

    return (
      <div className="mt-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 space-y-1">
        {m.summary && <p className="text-[11px] text-foreground/90">{m.summary}</p>}
        {changedFields.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Changed: {changedFields.join(", ")}
          </p>
        )}
        {entries.slice(0, 5).map(([field, value]) => (
          <p key={field} className="text-[11px] text-muted-foreground break-words">
            {field}: {String(value?.old ?? "null")} → {String(value?.new ?? "null")}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Audit Logs</h3>
        <p className="text-xs text-muted-foreground mt-0.5">System-wide events with user, patient, caregiver, event type, source and date filters</p>
      </div>

      <Card className="care-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Input
            placeholder="User ID"
            value={filters.userId}
            onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
          />
          <Input
            placeholder="Patient ID"
            value={filters.patientId}
            onChange={(e) => setFilters((prev) => ({ ...prev, patientId: e.target.value }))}
          />
          <Input
            placeholder="Caregiver ID"
            value={filters.caregiverId}
            onChange={(e) => setFilters((prev) => ({ ...prev, caregiverId: e.target.value }))}
          />
          <Select
            value={filters.eventType}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, eventType: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Event Types</SelectItem>
              {uniqueEventTypes.map((eventType) => (
                <SelectItem key={eventType} value={eventType}>{eventType}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.source}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, source: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {uniqueSources.map((source) => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
          />
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleApplyFilters} className="w-full">Apply</Button>
            <Button variant="outline" onClick={handleResetFilters} className="w-full">Reset</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="care-card overflow-hidden">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Activity ({logs.length} events)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[620px]">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading audit logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No audit logs found for the selected filters.</div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map((log) => (
                  <div key={log.id} className="px-6 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          {getActionIcon(log.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant={getActionVariant(log.action)} className="text-[11px]">{formatAction(log.action)}</Badge>
                            {log.event_type && <span className="text-[11px] text-muted-foreground">{log.event_type}</span>}
                            {log.source && <Badge variant="outline" className="text-[10px]">{log.source}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {log.user_id && <p>User: {log.user_id}</p>}
                            {log.patient_id && <p>Patient: {log.patient_id}</p>}
                            {log.caregiver_id && <p>Caregiver: {log.caregiver_id}</p>}
                            {log.entity_id && <p>Entity ID: {log.entity_id}</p>}
                            {log.ip_address && <p>IP: {log.ip_address}</p>}
                          </div>
                          {renderMetadata(log.metadata)}
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogsViewer;
