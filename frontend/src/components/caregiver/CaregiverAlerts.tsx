import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle, RefreshCw } from "lucide-react";
import { formatRelativeTime, parseDateTime } from "@/lib/datetime";
import { AlertLike, getAlertCategory, getAlertVisualStyle, isEmergencyAlert } from "@/lib/alert-ui";

type AlertItem = AlertLike;

const AlertCard = ({ alert }: { alert: AlertItem }) => {
  const style = getAlertVisualStyle(alert);
  const category = getAlertCategory(alert);
  const isEmergency = isEmergencyAlert(alert);

  const typeLabel = isEmergency
    ? "Emergency"
    : category === "sos"
      ? "SOS"
      : category === "geofence"
        ? "Geofence"
        : category === "medication"
          ? "Medication"
          : "Inactivity";

  return (
    <div className={`p-4 rounded-lg border-l-4 ${style.container} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${style.iconWrap}`}>
            <AlertCircle className={`w-5 h-5 ${style.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="font-semibold text-sm">{alert.patient_name ?? "Patient"}</p>
              {isEmergency && (
                <Badge variant="destructive" className="text-[10px] h-4 px-1.5 font-bold">SERIOUS</Badge>
              )}
              <Badge className={`text-[10px] h-4 px-1.5 ${style.badge}`}>
                {typeLabel}
              </Badge>
            </div>
            <p className="text-sm font-medium">{alert.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
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
  // Sort alerts by created_at descending (most recent first)
  const sortedAlerts = [...alerts].sort((a, b) => 
    (parseDateTime(b.created_at)?.getTime() || 0) - (parseDateTime(a.created_at)?.getTime() || 0)
  );

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
        ) : sortedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <CheckCircle className="w-10 h-10 text-success" />
            <p className="font-medium text-foreground">No Alerts</p>
            <p className="text-sm">All your patients are safe and sound.</p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
            {sortedAlerts.map(a => <AlertCard key={a.id} alert={a} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
