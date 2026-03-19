import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { AlertDetailModal } from "./AlertDetailModal";
import { formatRelativeTime } from "@/lib/datetime";

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

export const NotificationDropdown = ({
  alerts,
  isMobile,
  onMarkAllRead,
  onAlertRead,
}: {
  alerts: AlertItem[];
  isMobile: boolean;
  onMarkAllRead: () => void;
  onAlertRead: (alertId: string, source: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const unread = alerts.filter(a => !a.is_read).length;

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  const handleAlertClick = async (alert: AlertItem) => {
    setSelectedAlert(alert);
    setDetailData(null);
    setLoadingDetail(true);
    setOpen(false);
    if (!alert.is_read) {
      onAlertRead(alert.id, alert.source ?? 'normal');
      const endpoint = alert.source === 'budii' ? `/budii-alerts/mark-read/${alert.id}` : `/alerts/mark-read/${alert.id}`;
      api.patch(endpoint).catch(() => {});
    }
    try {
      if (alert.source === 'budii') {
        // Try to fetch the original alert by event_id (may not exist)
        if (alert.event_id) {
          try {
            const data = await api.get(`/alerts/${alert.event_id}`) as any;
            setDetailData(data);
          } catch (err: any) {
            // If original alert not found, fall back to patient alert details
            setDetailData({
              id: alert.id,
              patient_name: alert.patient_name,
              title: alert.title,
              message: alert.message,
              alert_type: alert.alert_type,
              priority: alert.priority,
              status: alert.status,
              voice_transcription: alert.voice_transcription,
              created_at: alert.created_at,
            });
          }
        } else {
          setDetailData({
            id: alert.id,
            patient_name: alert.patient_name,
            title: alert.title,
            message: alert.message,
            alert_type: alert.alert_type,
            priority: alert.priority,
            status: alert.status,
            voice_transcription: alert.voice_transcription,
            created_at: alert.created_at,
          });
        }
      } else {
        const data = await api.get(`/alerts/${alert.id}`) as any;
        setDetailData(data);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const getAlertStyle = (source?: string) => {
    if (source === 'budii') {
      return { bg: "bg-destructive/10", icon: "text-destructive", itemBg: "bg-destructive/[0.08]", border: "border-l-destructive" };
    }
    return { bg: "bg-primary/10", icon: "text-primary", itemBg: "bg-primary/[0.06]", border: "border-l-primary/50" };
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant={isMobile ? "ghost" : "outline"}
        size={isMobile ? "icon" : "default"}
        className="relative gap-1.5 border-border/60 bg-background/80 hover:bg-background"
        onClick={() => setOpen(v => !v)}
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {!isMobile && <span className="hidden sm:inline text-xs">Notifications</span>}
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <>
                    <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{unread} Unread</Badge>
                    <button
                      className="text-[11px] text-primary hover:underline"
                      onClick={() => { onMarkAllRead(); }}
                    >
                      Mark all read
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <CheckCircle className="w-7 h-7" />
                  <p className="text-sm">All clear!</p>
                </div>
              ) : (
                alerts.slice(0, 8).map(alert => {
                  const s = getAlertStyle(alert.source);
                  const isBudii = alert.source === 'budii';
                  const isUnread = !alert.is_read;
                  return (
                    <div
                      key={alert.id}
                      className={`flex cursor-pointer items-start gap-3 border-l-2 px-4 py-3 transition-colors ${s.itemBg} ${s.border} hover:opacity-90`}
                      onClick={() => handleAlertClick(alert)}
                    >
                      <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${s.bg}`}>
                        <AlertCircle className={`w-3.5 h-3.5 ${s.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${isUnread ? 'font-bold' : 'font-normal text-muted-foreground'}`}>
                          {alert.patient_name ?? "Patient"} — {alert.title}
                          {isBudii && <span className="text-destructive font-bold ml-1">●</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatRelativeTime(alert.created_at)}</p>
                      </div>
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          detail={detailData}
          loading={loadingDetail}
          onClose={() => { setSelectedAlert(null); setDetailData(null); }}
        />
      )}
    </div>
  );
};
