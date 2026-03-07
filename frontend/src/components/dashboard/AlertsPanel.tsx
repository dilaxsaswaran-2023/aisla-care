import { AlertCircle, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AlertsPanelProps {
  detailed?: boolean;
}

const AlertsPanel = ({ detailed = false }: AlertsPanelProps) => {
  const alerts = [
    {
      id: 1,
      type: "sos",
      patient: "John Davies",
      message: "SOS button pressed",
      time: "2 minutes ago",
      location: "Home - Living Room",
      priority: "high"
    },
    {
      id: 2,
      type: "reminder",
      patient: "Margaret Smith",
      message: "Medication reminder missed",
      time: "15 minutes ago",
      location: "Home",
      priority: "medium"
    },
    {
      id: 3,
      type: "location",
      patient: "Patricia Wilson",
      message: "Geofence boundary crossed",
      time: "1 hour ago",
      location: "Outside safe zone",
      priority: "medium"
    }
  ];

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-4 rounded-lg border-l-4 ${
            alert.priority === "high"
              ? "border-destructive bg-destructive/5"
              : "border-warning bg-warning/5"
          } transition-all hover:shadow-md`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                alert.priority === "high" ? "bg-destructive/10" : "bg-warning/10"
              }`}>
                <AlertCircle className={`w-5 h-5 ${
                  alert.priority === "high" ? "text-destructive" : "text-warning"
                }`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground mb-1">
                  {alert.patient}
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  {alert.message}
                </p>
                
                {detailed && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {alert.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {alert.location}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <Button 
              size="sm" 
              variant={alert.priority === "high" ? "destructive" : "outline"}
              className="flex-shrink-0"
            >
              Respond
            </Button>
          </div>
        </div>
      ))}
      
      {!detailed && alerts.length > 2 && (
        <Button variant="ghost" className="w-full text-primary hover:text-primary-hover">
          View All Alerts
        </Button>
      )}
    </div>
  );
};

export default AlertsPanel;
