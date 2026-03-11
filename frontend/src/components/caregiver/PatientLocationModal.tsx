import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Clock, Navigation, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface PatientLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

interface LocationData {
  id: string;
  patient_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  captured_at: string;
}

interface CurrentLocation extends LocationData {
  updated_at: string;
}

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
      ) as LocationData[];
      setRecentLocations(recentData || []);
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

  const getGoogleMapsUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  const getAccuracyColor = (accuracy?: number) => {
    if (typeof accuracy !== 'number' || !isFinite(accuracy)) return 'bg-red-100 text-red-800';
    if (accuracy < 10) return 'bg-green-100 text-green-800';
    if (accuracy < 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const formatNumber = (value: number | undefined | null, decimals: number) => {
    if (typeof value === 'number' && isFinite(value)) return value.toFixed(decimals);
    return '—';
  };

  return (
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
                        {formatNumber(currentLocation.latitude, 6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Longitude</p>
                      <p className="text-sm font-monospace font-semibold">
                        {formatNumber(currentLocation.longitude, 6)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Accuracy</p>
                      <Badge
                        className={`text-xs mt-1 ${getAccuracyColor(currentLocation.accuracy)}`}
                        variant="secondary"
                      >
                        {typeof currentLocation.accuracy === 'number' && isFinite(currentLocation.accuracy)
                          ? `±${currentLocation.accuracy.toFixed(2)}m`
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
                    onClick={() => {
                      const lat = currentLocation.latitude;
                      const lng = currentLocation.longitude;
                      if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng)) {
                        window.open(getGoogleMapsUrl(lat, lng), '_blank');
                      } else {
                        toast({ title: 'No coordinates', description: 'Latitude/Longitude unavailable' });
                      }
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on Google Maps
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
                                className={`text-[10px] ${getAccuracyColor(location.accuracy)}`}
                                variant="secondary"
                              >
                                {typeof location.accuracy === 'number' && isFinite(location.accuracy)
                                  ? `±${location.accuracy.toFixed(2)}m`
                                  : 'Accuracy N/A'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Lat: </span>
                                <span className="font-mono font-semibold">
                                  {formatNumber(location.latitude, 6)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Lng: </span>
                                <span className="font-mono font-semibold">
                                  {formatNumber(location.longitude, 6)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              const lat = location.latitude;
                              const lng = location.longitude;
                              if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng)) {
                                window.open(getGoogleMapsUrl(lat, lng), '_blank');
                              } else {
                                toast({ title: 'No coordinates', description: 'Latitude/Longitude unavailable' });
                              }
                            }}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
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
  );
};
