import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, MapPin, Clock, Phone, Video, Bell, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  created_at: string;
}

interface FamilyStatusProps {
  patient: { id: string; name: string } | null;
  caregiver: { id: string; name: string } | null;
  alerts: AlertItem[];
  loading: boolean;
  onCallCaregiver: () => void;
  onMessageCaregiver: () => void;
}

const severityColor: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-destructive/70",
  medium: "bg-warning",
  low: "bg-success",
};

const FamilyStatus = ({
  patient,
  caregiver,
  alerts,
  loading,
  onCallCaregiver,
  onMessageCaregiver,
}: FamilyStatusProps) => {
  const navigate = useNavigate();

  const recentAlerts = alerts.slice(0, 5);
  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="care-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Current Status
            </span>
            <Heart className="w-4 h-4 text-success" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
            <span className="text-2xl font-bold text-success">Safe & Well</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {patient ? patient.name : "—"}
          </p>
        </Card>
        <Card
          className="care-card p-5 cursor-pointer hover:ring-1 hover:ring-primary/30 transition"
          onClick={() => navigate("?tab=location")}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Location
            </span>
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <p className="text-lg font-semibold text-foreground">View Map</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tap to see real-time location
          </p>
        </Card>
      </div>

      {/* Today's alerts as activity */}
      <Card className="care-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent alerts
            </p>
          ) : (
            recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    severityColor[alert.severity] || "bg-muted-foreground"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">
                      {alert.title}
                    </p>
                    <Badge variant="outline" className="text-xs capitalize shrink-0">
                      {alert.severity}
                    </Badge>
                  </div>
                  {alert.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {alert.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge
                  variant={alert.status === "resolved" ? "secondary" : "outline"}
                  className="text-xs shrink-0 capitalize"
                >
                  {alert.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Assigned Caregiver */}
      <Card className="care-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assigned Caregiver</CardTitle>
        </CardHeader>
        <CardContent>
          {caregiver ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {initials(caregiver.name)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {caregiver.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Senior Care Specialist</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8"
                  onClick={onCallCaregiver}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8"
                  onClick={onMessageCaregiver}
                >
                  <Video className="w-3.5 h-3.5" />
                  Video
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No caregiver assigned</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FamilyStatus;
