import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle, Bell, Users, BotMessageSquare, Cpu, Clock, CheckCircle, Construction, RefreshCw,
} from "lucide-react";

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

interface Contact { id: string; name: string; }

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

const AlertCard = ({ alert, detailed }: { alert: AlertItem; detailed?: boolean }) => {
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
            {detailed && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(alert.created_at)}
              </p>
            )}
          </div>
        </div>
        {!detailed && (
          <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(alert.created_at)}</span>
        )}
      </div>
    </div>
  );
};

const ComingSoon = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
      <Construction className="w-7 h-7 text-muted-foreground" />
    </div>
    <div>
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground mt-1">This feature is coming soon. Stay tuned!</p>
    </div>
    <Badge variant="secondary">Coming Soon</Badge>
  </div>
);

interface CaregiverOverviewProps {
  patients: Contact[];
  alerts: AlertItem[];
  loading: boolean;
  loadingAlerts: boolean;
  onTabChange: (tab: string) => void;
  onRefresh: () => void;
}

export const CaregiverOverview = ({
  patients,
  alerts,
  loading,
  loadingAlerts,
  onTabChange,
  onRefresh,
}: CaregiverOverviewProps) => {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Patients",
            value: loading ? "…" : patients.length,
            sub: patients.length === 0 ? "No patients assigned" : "All patients safe",
            icon: Users,
            color: "text-primary",
          },
          {
            label: "Active Alerts",
            value: loadingAlerts ? "…" : alerts.filter(a => a.status === "active").length,
            sub: alerts.filter(a => a.status === "active").length === 0 ? "No active alerts" : "Requires attention",
            icon: AlertCircle,
            color: alerts.filter(a => a.status === "active").length > 0 ? "text-destructive" : "text-success",
          },
          {
            label: "Budii Interactions",
            value: "--",
            sub: "Coming soon",
            icon: BotMessageSquare,
            color: "text-muted-foreground",
          },
          {
            label: "Connected Devices",
            value: "--",
            sub: "Coming soon",
            icon: Cpu,
            color: "text-muted-foreground",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="care-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className={`stat-value ${stat.color}`}>{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </Card>
          );
        })}
      </div>

      {/* Recent Alerts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="care-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Alerts</CardTitle>
                <CardDescription>Latest notifications from your patients</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <CheckCircle className="w-8 h-8" />
                <p className="text-sm">No alerts — all clear!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.slice(0, 5).map(a => <AlertCard key={a.id} alert={a} />)}
                {alerts.length > 5 && (
                  <Button variant="ghost" className="w-full text-primary text-sm" onClick={() => onTabChange("alerts")}>
                    View all {alerts.length} alerts
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budii Interactions Coming Soon */}
        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Budii Interactions</CardTitle>
            <CardDescription>AI companion conversation insights</CardDescription>
          </CardHeader>
          <CardContent>
            <ComingSoon label="Budii Interaction Insights" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
