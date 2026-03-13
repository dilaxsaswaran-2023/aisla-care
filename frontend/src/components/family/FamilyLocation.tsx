import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Navigation, RefreshCw, Route, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationData {
  id?: string;
  patient_id?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  accuracy?: number;
  captured_at?: string;
  updated_at?: string;
}

interface PatientItem {
  id: string;
  name: string;
}

interface FamilyLocationProps {
  patients: PatientItem[];
  selectedPatientId: string | null;
  onSelectPatient: (id: string) => void;
  patient: PatientItem | null;
}

const getLat = (loc: any) =>
  typeof loc?.latitude === "number" ? loc.latitude : typeof loc?.lat === "number" ? loc.lat : undefined;

const getLng = (loc: any) =>
  typeof loc?.longitude === "number" ? loc.longitude : typeof loc?.lng === "number" ? loc.lng : undefined;

const normalizeRecent = (input: any): LocationData[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (input.locations && Array.isArray(input.locations)) return input.locations;
  if (input.data && Array.isArray(input.data)) return input.data;
  if (input.results && Array.isArray(input.results)) return input.results;
  return [];
};

const FamilyLocation = ({ patients, selectedPatientId, onSelectPatient, patient }: FamilyLocationProps) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [recentLocations, setRecentLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const { toast } = useToast();

  const loadLocations = async () => {
    if (!patient?.id) return;
    setLoading(true);
    try {
      const [current, recent] = await Promise.all([
        api.get(`/gps/patient/${patient.id}/current`).catch(() => null),
        api.get(`/gps/patient/${patient.id}/recent`).catch(() => null),
      ]);
      setCurrentLocation(current as LocationData | null);
      setRecentLocations(normalizeRecent(recent));
    } catch {
      toast({ title: "Location Error", description: "Could not fetch location data.", variant: "destructive" });
      setCurrentLocation(null);
      setRecentLocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, [patient?.id]);

  useEffect(() => {
    const centerLat = getLat(currentLocation) ?? (recentLocations.length > 0 ? getLat(recentLocations[0]) : undefined);
    const centerLng = getLng(currentLocation) ?? (recentLocations.length > 0 ? getLng(recentLocations[0]) : undefined);

    if (centerLat === undefined || centerLng === undefined) return;

    const mapContainer = document.getElementById("family-location-map");
    if (!mapContainer) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map("family-location-map", { zoomControl: true }).setView([centerLat, centerLng], 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: " OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    if (currentLocation && getLat(currentLocation) !== undefined && getLng(currentLocation) !== undefined) {
      const blueIcon = L.divIcon({
        html: `<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
        className: "",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([getLat(currentLocation)!, getLng(currentLocation)!], { icon: blueIcon })
        .addTo(map)
        .bindPopup(`<b>Current Location</b><br/>${patient?.name || "Patient"}`);
    }

    recentLocations.forEach((loc, idx) => {
      const lat = getLat(loc);
      const lng = getLng(loc);
      if (lat === undefined || lng === undefined) return;
      const redIcon = L.divIcon({
        html: `<div style="background:#dc2626;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);opacity:${Math.max(0.25, 1 - idx * 0.12)};"></div>`,
        className: "",
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      L.marker([lat, lng], { icon: redIcon })
        .addTo(map)
        .bindPopup(`<b>Recent Location</b><br/>${loc.captured_at ? new Date(loc.captured_at).toLocaleString() : ""}`);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [currentLocation, recentLocations, patient?.name]);

  const hasLocation = !!currentLocation && getLat(currentLocation) !== undefined && getLng(currentLocation) !== undefined;

  return (
    <div className="space-y-4">
      <Card className="care-card">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {patients.map((p) => (
              <Button
                key={p.id}
                variant={selectedPatientId === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectPatient(p.id)}
                className="h-8"
              >
                <UserRound className="w-3.5 h-3.5 mr-1.5" />
                {p.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="care-card xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Live Location</CardTitle>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={loadLocations} disabled={loading || !patient?.id}>
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!patient?.id ? (
              <div className="flex items-center justify-center h-72 text-muted-foreground">No linked patient</div>
            ) : !hasLocation && !loading ? (
              <div className="flex items-center justify-center h-72 text-muted-foreground">No location data available</div>
            ) : loading ? (
              <div className="flex items-center justify-center h-72">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <div id="family-location-map" className="w-full h-[430px] rounded-b-xl" />
            )}
          </CardContent>
        </Card>

        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="w-4 h-4" />
              Location Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasLocation ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Navigation className="w-4 h-4 text-primary" />
                  <span>{getLat(currentLocation)!.toFixed(6)}, {getLng(currentLocation)!.toFixed(6)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>{patient?.name || "Patient"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {currentLocation?.updated_at || currentLocation?.captured_at
                      ? new Date((currentLocation.updated_at ?? currentLocation.captured_at) as string).toLocaleString()
                      : "-"}
                  </span>
                </div>
                <Badge variant="outline">{recentLocations.length} recent points</Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No location signal currently available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {recentLocations.length > 0 ? (
        <Card className="care-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Movement Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentLocations.slice(0, 8).map((loc, idx) => {
              const lat = getLat(loc);
              const lng = getLng(loc);
              if (lat === undefined || lng === undefined) return null;
              const at = loc.captured_at || loc.updated_at;
              return (
                <div key={loc.id || `${lat}-${lng}-${idx}`} className="flex items-center justify-between border rounded-lg p-2.5">
                  <div className="text-sm">
                    <p className="font-medium">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
                    <p className="text-xs text-muted-foreground">Accuracy: {typeof loc.accuracy === "number" ? `${loc.accuracy.toFixed(1)} m` : "-"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{at ? new Date(at).toLocaleString() : "-"}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default FamilyLocation;
