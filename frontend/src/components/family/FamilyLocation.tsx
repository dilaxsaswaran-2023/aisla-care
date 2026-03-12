import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Navigation, RefreshCw } from "lucide-react";
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
  accuracy?: any;
  captured_at?: string;
  updated_at?: string;
}

interface FamilyLocationProps {
  patientId: string | null;
  patientName: string;
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

const FamilyLocation = ({ patientId, patientName }: FamilyLocationProps) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [recentLocations, setRecentLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const { toast } = useToast();

  const loadLocations = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [current, recent] = await Promise.all([
        api.get(`/gps/patient/${patientId}/current`).catch(() => null),
        api.get(`/gps/patient/${patientId}/recent`).catch(() => null),
      ]);
      setCurrentLocation(current as LocationData | null);
      setRecentLocations(normalizeRecent(recent));
    } catch (err) {
      toast({ title: "Location Error", description: "Could not fetch location data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, [patientId]);

  // Build/update Leaflet map whenever data changes
  useEffect(() => {
    const centerLat = getLat(currentLocation) ?? (recentLocations.length > 0 ? getLat(recentLocations[0]) : undefined);
    const centerLng = getLng(currentLocation) ?? (recentLocations.length > 0 ? getLng(recentLocations[0]) : undefined);

    if (centerLat === undefined || centerLng === undefined) return;

    const mapContainer = document.getElementById("family-location-map");
    if (!mapContainer) return;

    // Destroy existing map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map("family-location-map", { zoomControl: true }).setView([centerLat, centerLng], 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Current location — blue marker
    if (currentLocation && getLat(currentLocation) !== undefined && getLng(currentLocation) !== undefined) {
      const blueIcon = L.divIcon({
        html: `<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
        className: "",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([getLat(currentLocation)!, getLng(currentLocation)!], { icon: blueIcon })
        .addTo(map)
        .bindPopup(`<b>Current Location</b><br/>${patientName}`);
    }

    // Recent locations — red markers
    recentLocations.forEach((loc, idx) => {
      const lat = getLat(loc);
      const lng = getLng(loc);
      if (lat === undefined || lng === undefined) return;
      const redIcon = L.divIcon({
        html: `<div style="background:#dc2626;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);opacity:${1 - idx * 0.12};"></div>`,
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
  }, [currentLocation, recentLocations, patientName]);

  const hasLocation = currentLocation && getLat(currentLocation) !== undefined;

  return (
    <div className="space-y-4">
      <Card className="care-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Real-time Location</CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={loadLocations} disabled={loading || !patientId}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!patientId ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No patient linked</p>
              </div>
            </div>
          ) : !hasLocation && !loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No location data available</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <div id="family-location-map" className="w-full h-[400px] rounded-b-xl" />
          )}
        </CardContent>
      </Card>

      {/* Location detail */}
      {hasLocation && (
        <Card className="care-card">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {getLat(currentLocation)!.toFixed(6)}, {getLng(currentLocation)!.toFixed(6)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Updated:{" "}
                {currentLocation?.updated_at || currentLocation?.captured_at
                  ? new Date(
                      (currentLocation.updated_at ?? currentLocation.captured_at)!
                    ).toLocaleString()
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {recentLocations.length} recent points
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FamilyLocation;
