import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle, RefreshCw } from "lucide-react";

interface AlertItem {
  id: string;
  alert_type: string;
  status: string;
  priority: string;
  title: string;
  message: string;
  voice_transcription?: string;
  patient_name?: string;
  created_at: string;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ALERT_TYPE_STYLE: Record<string, { border: string; bg: string; icon: string }> = {
  sos:        { border: "border-destructive", bg: "bg-destructive/5",  icon: "text-destructive" },
  fall:       { border: "border-destructive", bg: "bg-destructive/5",  icon: "text-destructive" },
  geofence:   { border: "border-warning",     bg: "bg-warning/5",      icon: "text-warning" },
  health:     { border: "border-warning",     bg: "bg-warning/5",      icon: "text-warning" },
  inactivity: { border: "border-muted",       bg: "bg-muted/30",       icon: "text-muted-foreground" },
};

function alertStyle(type: string) {
  return ALERT_TYPE_STYLE[type] ?? ALERT_TYPE_STYLE.inactivity;
}

const AlertCard = ({ alert }: { alert: AlertItem }) => {
  const s = alertStyle(alert.alert_type);
  return (
    <div className={`p-4 rounded-lg border-l-4 ${s.border} ${s.bg} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
            <AlertCircle className={`w-5 h-5 ${s.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="font-semibold text-sm">{alert.patient_name ?? "Patient"}</p>
              <Badge variant={alert.priority === "critical" || alert.priority === "high" ? "destructive" : "secondary"} className="text-[10px] h-4 px-1.5">
                {alert.alert_type.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{alert.title}</p>
            {alert.voice_transcription && (
              <p className="text-xs italic text-muted-foreground mt-1">
                "{alert.voice_transcription}"
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(alert.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CaregiverAlertsProps {
  alerts: AlertItem[];
  loadingAlerts: boolean;
  onRefresh: () => void;
}

export const CaregiverAlerts = ({
  alerts,
  loadingAlerts,
  onRefresh,
}: CaregiverAlertsProps) => {
  return (
    <Card className="care-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Alert Management</CardTitle>
            <CardDescription>Monitor and respond to patient alerts</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingAlerts ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <CheckCircle className="w-10 h-10 text-success" />
            <p className="font-medium text-foreground">No Alerts</p>
            <p className="text-sm">All your patients are safe and sound.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(a => <AlertCard key={a.id} alert={a} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
