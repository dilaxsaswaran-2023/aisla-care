import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Clock, Navigation, Map as MapIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PatientLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

interface LocationData {
  id: string;
  patient_id: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  accuracy?: any;
  captured_at: string;
}

interface CurrentLocation extends LocationData {
  updated_at: string;
}

const getLat = (loc: any) => {
  if (!loc) return undefined;
  return typeof loc.latitude === 'number' ? loc.latitude : (typeof loc.lat === 'number' ? loc.lat : undefined);
};

const getLng = (loc: any) => {
  if (!loc) return undefined;
  return typeof loc.longitude === 'number' ? loc.longitude : (typeof loc.lng === 'number' ? loc.lng : undefined);
};

const getAccuracyValue = (loc: any) => {
  if (!loc) return undefined;
  if (loc.accuracy && typeof loc.accuracy === 'object') {
    return typeof loc.accuracy.parsedValue === 'number' ? loc.accuracy.parsedValue : (typeof loc.accuracy.value === 'number' ? loc.accuracy.value : undefined);
  }
  return typeof loc.accuracy === 'number' ? loc.accuracy : undefined;
};

// Normalize API responses into an array of LocationData
const normalizeRecent = (input: any): LocationData[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input as LocationData[];
  if (input.data && Array.isArray(input.data)) return input.data as LocationData[];
  if (input.results && Array.isArray(input.results)) return input.results as LocationData[];
  if (input.locations && Array.isArray(input.locations)) return input.locations as LocationData[];
  if (typeof input === 'object') {
    // treat objects with numeric keys or maps
    const vals = (Object.values(input) as any[]).filter((v: any) => v && (typeof v.latitude === 'number' || typeof v.lat === 'number' || (v.latitude === undefined && v.lat === undefined && v.captured_at)));
    if (vals.length) return vals as LocationData[];
  }
  return [];
};

// Map component for displaying locations
const LocationMap = ({ currentLocation, recentLocations, patientName }: { currentLocation: CurrentLocation | null; recentLocations: LocationData[]; patientName: string }) => {
  useEffect(() => {
    if (!currentLocation && recentLocations.length === 0) return;

    const mapContainer = document.getElementById('location-map');
    if (!mapContainer) return;

    // Get center coordinates
    const centerLat = currentLocation ? getLat(currentLocation) : (recentLocations.length > 0 ? getLat(recentLocations[0]) : 0);
    const centerLng = currentLocation ? getLng(currentLocation) : (recentLocations.length > 0 ? getLng(recentLocations[0]) : 0);

    if (!centerLat || !centerLng) return;

    // Initialize map
    const map = L.map('location-map').setView([centerLat, centerLng], 13);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Create custom icons
    const createCustomIcon = (color: string) => {
      return L.divIcon({
        html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
          <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
        </div>`,
        className: 'custom-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15],
      });
    };

    // Add current location marker
    if (currentLocation) {
      const lat = getLat(currentLocation);
      const lng = getLng(currentLocation);
      if (lat && lng) {
        L.marker([lat, lng], { icon: createCustomIcon('#3B82F6') })
          .bindPopup(`<strong>Current Location</strong><br>${patientName}<br>Updated: ${new Date(currentLocation.updated_at).toLocaleString()}`)
          .addTo(map);
      }
    }

    // Add recent locations markers
    if (Array.isArray(recentLocations)) {
      recentLocations.forEach((location, index) => {
        const lat = getLat(location);
        const lng = getLng(location);
        if (lat && lng) {
          L.marker([lat, lng], { icon: createCustomIcon('#EF4444') })
            .bindPopup(`<strong>Recent Location #${index + 1}</strong><br>Captured: ${new Date(location.captured_at).toLocaleString()}`)
            .addTo(map);
        }
      });
    }

    return () => {
      map.remove();
    };
  }, [currentLocation, recentLocations, patientName]);

  return <div id="location-map" style={{ width: '100%', height: '400px', borderRadius: '8px' }} />;
};

export const PatientLocationModal = ({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientLocationModalProps) => {
  const { toast } = useToast();
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [recentLocations, setRecentLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  useEffect(() => {
    if (open) {
      loadLocations();
    }
  }, [open, patientId]);

  const loadLocations = async () => {
    setLoading(true);
    try {
      // Load current location
      const currentData = await api.get(
        `/gps/patient/${patientId}/current`
      ) as CurrentLocation;
      setCurrentLocation(currentData);

      // Load recent locations
      const recentData = await api.get(
        `/gps/patient/${patientId}/recent`
      ) as any;
      setRecentLocations(normalizeRecent(recentData));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load location data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const formatNumber = (value: number | undefined | null, decimals: number) => {
    if (typeof value === 'number' && isFinite(value)) return value.toFixed(decimals);
    return '—';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Location: {patientName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading location data...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Location */}
            {currentLocation ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-primary" />
                      Current Location
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Latitude</p>
                      <p className="text-sm font-monospace font-semibold">
                        {formatNumber(getLat(currentLocation), 6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Longitude</p>
                      <p className="text-sm font-monospace font-semibold">
                        {formatNumber(getLng(currentLocation), 6)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Accuracy</p>
                      <Badge
                        className={`text-xs mt-1 ${
                          typeof getAccuracyValue(currentLocation) === 'number' && isFinite(getAccuracyValue(currentLocation)!)
                            ? getAccuracyValue(currentLocation)! < 10
                              ? 'bg-green-100 text-green-800'
                              : getAccuracyValue(currentLocation)! < 50
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                        variant="secondary"
                      >
                        {typeof getAccuracyValue(currentLocation) === 'number' && isFinite(getAccuracyValue(currentLocation)!)
                          ? `±${getAccuracyValue(currentLocation)!.toFixed(2)}m`
                          : 'Accuracy N/A'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Updated</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(currentLocation.updated_at)}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-xs"
                    onClick={() => setShowMapModal(true)}
                  >
                    <MapIcon className="w-3 h-3" />
                    View on Map
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                No current location data available
              </div>
            )}

            {/* Recent Locations */}
            {recentLocations.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Recent Locations ({recentLocations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recentLocations.map((location, index) => (
                      <div
                        key={location.id}
                        className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold bg-muted px-2 py-1 rounded">
                                #{index + 1}
                              </span>
                              <time className="text-xs text-muted-foreground">
                                {formatTime(location.captured_at)}
                              </time>
                              <Badge
                                className={`text-[10px] ${
                                  typeof getAccuracyValue(location) === 'number' && isFinite(getAccuracyValue(location)!)
                                    ? getAccuracyValue(location)! < 10
                                      ? 'bg-green-100 text-green-800'
                                      : getAccuracyValue(location)! < 50
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                                variant="secondary"
                              >
                                {typeof getAccuracyValue(location) === 'number' && isFinite(getAccuracyValue(location)!)
                                  ? `±${getAccuracyValue(location)!.toFixed(2)}m`
                                  : 'Accuracy N/A'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Lat: </span>
                                <span className="font-mono font-semibold">
                                  {formatNumber(getLat(location), 6)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Lng: </span>
                                <span className="font-mono font-semibold">
                                  {formatNumber(getLng(location), 6)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!currentLocation && recentLocations.length === 0 && (
              <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                No location data available for this patient
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Map Modal */}
    <Dialog open={showMapModal} onOpenChange={setShowMapModal}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapIcon className="w-5 h-5" />
            Location Map: {patientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#3B82F6',
                  borderRadius: '50%',
                }}
              />
              <span>Current Location</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#EF4444',
                  borderRadius: '50%',
                }}
              />
              <span>Recent Locations</span>
            </div>
          </div>

          <LocationMap currentLocation={currentLocation} recentLocations={recentLocations} patientName={patientName} />

          <Button variant="outline" className="w-full" onClick={() => setShowMapModal(false)}>
            Close Map
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};
