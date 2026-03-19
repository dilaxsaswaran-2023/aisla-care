import { createPortal } from "react-dom";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";
import { getAlertCategory, getAlertVisualStyle, isEmergencyAlert } from "@/lib/alert-ui";

interface AlertItem {
  id: string;
  alert_type: string;
  status: string;
  priority: string;
  title: string;
  message: string;
  voice_transcription?: string;
  patient_name?: string;
  event_id?: string;
  created_at: string;
  source?: string;
  is_read?: boolean;
  is_added_to_emergency?: boolean;
}

export const AlertDetailModal = ({
  detail,
  loading,
  alert,
  onClose,
}: {
  detail: any;
  loading: boolean;
  alert: AlertItem;
  onClose: () => void;
}) => {
  const isEmergency = isEmergencyAlert(alert as any);
  const style = getAlertVisualStyle(alert as any);
  const category = getAlertCategory(alert as any);

  const typeLabel = isEmergency
    ? "Emergency"
    : category === "sos"
      ? "SOS"
      : category === "geofence"
        ? "Geofence"
        : category === "medication"
          ? "Medication"
          : "Inactivity";

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-md border border-border overflow-hidden">
        <div className={`flex items-center justify-between px-4 py-3 border-b border-border ${style.container}`}>
          <div className="flex items-center gap-2">
            <AlertCircle className={`w-4 h-4 ${style.icon}`} />
            <span className="font-semibold text-sm">{isEmergency ? "Critical Alert" : `${typeLabel} Alert`}</span>
          </div>
          <button onClick={onClose} title="Close" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <div className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <p className="text-sm">Loading details...</p>
          </div>
        ) : detail ? (
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Patient</p>
                <p className="font-semibold">{detail.patient_name ?? alert.patient_name}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                <Badge className={`text-[10px] ${style.badge}`}>{typeLabel}</Badge>
                {detail.priority && (
                  <Badge variant={detail.priority === "critical" || isEmergency ? "destructive" : "secondary"} className="text-[10px]">
                    {detail.priority}
                  </Badge>
                )}
                {detail.status && <Badge variant="outline" className="text-[10px]">{detail.status}</Badge>}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Title</p>
              <p className="font-semibold text-base">{detail.title}</p>
            </div>
            {detail.alert_type && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Type</p>
                <p className="text-sm capitalize">{detail.alert_type}</p>
              </div>
            )}
            {detail.message && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Message</p>
                <p className="text-sm text-foreground/80">{detail.message}</p>
              </div>
            )}
            {detail.voice_transcription && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Voice Note</p>
                <p className="text-sm italic bg-muted px-3 py-2 rounded-lg text-foreground/70">"{detail.voice_transcription}"</p>
              </div>
            )}
            <div className="pt-1 border-t border-border">
              <p className="text-[11px] text-muted-foreground">{formatDateTime(detail.created_at)}</p>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">Could not load alert details.</div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
};
