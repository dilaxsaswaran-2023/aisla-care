import { MapPin, Navigation, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PatientMap = () => {
  const patients = [
    { id: 1, name: "Margaret Smith", location: "Home — Living Room", status: "safe", lastSeen: "2 mins ago" },
    { id: 2, name: "John Davies", location: "Home — Garden", status: "alert", lastSeen: "5 mins ago" },
    { id: 3, name: "Patricia Wilson", location: "Home — Bedroom", status: "safe", lastSeen: "1 min ago" },
  ];

  return (
    <div className="relative w-full h-[460px] bg-muted rounded-b-xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
        <div className="text-center space-y-5 px-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground mb-1">Real-Time Location Tracking</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Live GPS monitoring with geofence alerts. Connect Google Maps or Mapbox for full map view.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {patients.map((patient) => (
              <div key={patient.id} className="bg-card p-4 rounded-xl shadow-sm border border-border text-left">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`status-dot ${patient.status === "safe" ? "status-dot-online" : "status-dot-warning"}`} />
                  <span className="text-sm font-medium">{patient.name}</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <Navigation className="w-3 h-3" />{patient.location}
                </p>
                <p className="text-[11px] text-muted-foreground">Last seen: {patient.lastSeen}</p>
                <Badge variant={patient.status === 'safe' ? 'outline' : 'secondary'} className="mt-2 text-[10px] gap-1">
                  <Shield className="w-3 h-3" />{patient.status === 'safe' ? 'In Safe Zone' : 'Outside Zone'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientMap;
