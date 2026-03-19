import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, CheckCircle, Activity, AlertTriangle, MapPin, Pill, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { AlertDetailModal } from "./AlertDetailModal";
import { formatRelativeTime, parseDateTime } from "@/lib/datetime";
import { ALERT_TABS, AlertLike, AlertTabKey, getAlertVisualStyle, matchesAlertTab } from "@/lib/alert-ui";

interface AlertItem extends AlertLike {
  event_id?: string;
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
  const [activeTab, setActiveTab] = useState<AlertTabKey>("overall");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const unread = alerts.filter(a => !a.is_read).length;
  const sortedAlerts = [...alerts].sort((a, b) =>
    (parseDateTime(b.created_at)?.getTime() || 0) - (parseDateTime(a.created_at)?.getTime() || 0)
  );
  const filteredAlerts = sortedAlerts.filter((alert) => matchesAlertTab(alert, activeTab));
  const tabCounts = ALERT_TABS.reduce<Record<AlertTabKey, number>>((acc, tab) => {
    acc[tab.key] = sortedAlerts.filter((alert) => matchesAlertTab(alert, tab.key)).length;
    return acc;
  }, {
    overall: 0,
    sos: 0,
    geofence: 0,
    medication: 0,
    inactivity: 0,
  });

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
      if (alert.source === 'budii') {
        api.patch(`/budii-alerts/mark-read/${alert.id}`).catch(() => {});
      } else if (alert.source === 'sos') {
        api.patch(`/sos-alerts/mark-read/${alert.id}`).catch(() => {});
      }
    }
    try {
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
    } finally {
      setLoadingDetail(false);
    }
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
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
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
            <div className="border-b border-border/60 px-2 py-1.5">
              <div className="flex items-center gap-1 overflow-x-auto">
                {ALERT_TABS.map((tab) => {
                  const IconComponent = {
                    Activity,
                    AlertTriangle,
                    MapPin,
                    Pill,
                    Clock,
                  }[tab.icon] as React.ComponentType<{ className?: string }>;
                  return (
                    <button
                      key={tab.key}
                      className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] whitespace-nowrap transition-colors ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setActiveTab(tab.key)}
                      title={tab.label}
                    >
                      {IconComponent && <IconComponent className="w-3 h-3" />}
                      <span className="text-[10px] leading-none">{tabCounts[tab.key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {filteredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-1 text-muted-foreground">
                  <CheckCircle className="w-6 h-6" />
                  <p className="text-xs">No alerts in this category.</p>
                </div>
              ) : (
                filteredAlerts.slice(0, 10).map(alert => {
                  const style = getAlertVisualStyle(alert);
                  const isUnread = !alert.is_read;

                  return (
                    <div
                      key={alert.id}
                      className={`cursor-pointer border-l-4 px-3 py-2 transition-colors ${style.container} hover:opacity-90`}
                      onClick={() => handleAlertClick(alert)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${style.iconWrap}`}>
                          <AlertCircle className={`w-3.5 h-3.5 ${style.icon}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate ${isUnread ? 'font-semibold' : 'font-medium text-muted-foreground'}`}>
                            {(alert.patient_name ?? "Patient") + " - " + alert.title}
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(alert.created_at)}</p>
                        {isUnread && (
                          <div className={`w-2 h-2 rounded-full shrink-0 ${style.accentDot}`} />
                        )}
                      </div>
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
