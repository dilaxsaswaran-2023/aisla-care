import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/datetime';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Patient {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface MapLocations {
  patient_id: string;
  latitude: number;
  longitude: number;
  patient_name: string;
  accuracy?: number;
  updated_at?: string;
}

const MapContent = ({ locations }: { locations: MapLocations[] }) => {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(
      locations.map((loc) => [loc.latitude, loc.longitude])
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [locations, map]);

  return null;
};

export const CaregiverLocation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [locations, setLocations] = useState<MapLocations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    loadPatientsAndLocations();
  }, [user]);

  const loadPatientsAndLocations = async () => {
    setLoading(true);
    try {
      const patientsData = await api.get('/users') as any[];
      const caregiverPatients = (patientsData || [])
        .map((p: any) => ({
          id: p._id || p.id,
          full_name: p.full_name || p.fullName || p.name || 'Unknown',
          email: p.email || null,
          role: p.role || null,
        }))
        .filter((p: any) => p.role === 'patient' && p.id);
      setPatients(caregiverPatients);

      const locationPromises = caregiverPatients.map((patient) =>
        api.get(`/gps/patient/${patient.id}/current`)
          .then((loc: any) => {
            if (!loc || loc.error) return null;
            const latitude = loc.latitude ?? loc.lat ?? null;
            const longitude = loc.longitude ?? loc.lng ?? null;
            if (latitude == null || longitude == null) return null;
            return {
              patient_id: patient.id,
              latitude: Number(latitude),
              longitude: Number(longitude),
              patient_name: patient.full_name,
              accuracy: loc.accuracy,
              updated_at: loc.created_at ?? loc.updated_at,
            };
          })
          .catch((err: any) => {
            console.debug(`Failed loading location for ${patient.id}:`, err);
            return null;
          })
      );

      const locs = await Promise.all(locationPromises);
      setLocations(locs.filter((loc) => loc !== null) as MapLocations[]);
    } catch (error) {
      console.error('Error loading patients/locations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load patient locations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPatientsAndLocations();
    setRefreshing(false);
    toast({
      title: 'Success',
      description: 'Location data refreshed',
    });
  };

  const defaultCenter: [number, number] = [6.9271, 79.8612];
  const defaultZoom = 13;

  return (
    <div className="space-y-4">
      <Card className="care-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Patient Location Tracking</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="h-[600px] flex items-center justify-center bg-muted rounded-b-lg">
              <div className="text-center">
                <div className="text-muted-foreground">Loading map data...</div>
              </div>
            </div>
          ) : patients.length === 0 ? (
            <div className="h-[600px] flex items-center justify-center bg-muted rounded-b-lg">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <div className="text-muted-foreground">No patients assigned</div>
              </div>
            </div>
          ) : (
            <>
              {locations.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-none p-4 text-sm text-yellow-800">
                  ⚠️ No location data available yet. Patients need to share their location first.
                </div>
              )}
              <MapContainer
                center={defaultCenter}
                zoom={defaultZoom}
                style={{ height: '600px', width: '100%' }}
                ref={mapRef}
                className="rounded-b-lg"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {locations.map((loc) => (
                  <Marker
                    key={loc.patient_id}
                    position={[loc.latitude, loc.longitude]}
                  >
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">{loc.patient_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </div>
                        {loc.accuracy && (
                          <div className="text-xs text-muted-foreground">
                            Accuracy: ±{loc.accuracy.toFixed(0)}m
                          </div>
                        )}
                        {loc.updated_at && (
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(loc.updated_at)}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
                <MapContent locations={locations} />
              </MapContainer>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="care-card bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <p className="text-xs text-blue-800">
            📍 <strong>Tip:</strong> Showing {locations.length} of {patients.length} patient locations. 
            Click on any marker to see patient details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
