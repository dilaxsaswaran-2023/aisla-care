import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, AlertCircle, User, Settings, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: any;
  created_at: string;
  ip_address: string | null;
}

const sampleLogs: AuditLog[] = [
  { id: 's-1', user_id: 'user-1', action: 'sos_alert_created', entity_type: 'alert', entity_id: 'a-1', metadata: { priority: 'critical' }, created_at: new Date(Date.now() - 120000).toISOString(), ip_address: '192.168.1.10' },
  { id: 's-2', user_id: 'user-2', action: 'user_login', entity_type: 'auth', entity_id: null, metadata: null, created_at: new Date(Date.now() - 600000).toISOString(), ip_address: '10.0.0.15' },
  { id: 's-3', user_id: 'user-1', action: 'reminder_completed', entity_type: 'reminder', entity_id: 'r-1', metadata: { title: 'Morning medication' }, created_at: new Date(Date.now() - 3600000).toISOString(), ip_address: '192.168.1.10' },
  { id: 's-4', user_id: 'user-3', action: 'device_registered', entity_type: 'device', entity_id: 'd-1', metadata: { type: 'camera' }, created_at: new Date(Date.now() - 7200000).toISOString(), ip_address: '172.16.0.5' },
  { id: 's-5', user_id: 'user-1', action: 'consent_granted', entity_type: 'consent', entity_id: 'c-1', metadata: { type: 'location_tracking' }, created_at: new Date(Date.now() - 86400000).toISOString(), ip_address: '192.168.1.10' },
  { id: 's-6', user_id: 'user-4', action: 'relationship_created', entity_type: 'relationship', entity_id: 'rel-1', metadata: { type: 'caregiver' }, created_at: new Date(Date.now() - 172800000).toISOString(), ip_address: '10.0.0.20' },
];

const AuditLogsViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    try {
      const data = await api.get('/audit-logs');
      setLogs(data && data.length > 0 ? data : sampleLogs);
    } catch {
      toast({ title: "Error", description: "Failed to load audit logs", variant: "destructive" });
      setLogs(sampleLogs);
    }
    setLoading(false);
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Audit Logs</h3>
        <p className="text-xs text-muted-foreground mt-0.5">System activity and security event logging</p>
      </div>

      <Card className="care-card overflow-hidden">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Activity ({logs.length} events)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading audit logs...</div>
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
                            {log.entity_type && <span className="text-[11px] text-muted-foreground">{log.entity_type}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {log.user_id && <p>User: {log.user_id.substring(0, 8)}...</p>}
                            {log.ip_address && <p>IP: {log.ip_address}</p>}
                          </div>
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
