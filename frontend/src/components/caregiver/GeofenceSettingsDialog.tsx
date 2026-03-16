import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Map, Loader2, Undo2, Redo2, Trash2, LocateFixed } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Patient {
  id: string;
  full_name: string;
}

interface PatientLocation {
  latitude: number;
  longitude: number;
}
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  geofencePatient: Patient | null;
  geofenceForm: any;
  setGeofenceForm: (f: any) => void;
  geofenceLoading: boolean;
  setGeofenceLoading: (v: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function GeofenceSettingsDialog({
  open,
  onOpenChange,
  geofencePatient,
  geofenceForm,
  setGeofenceForm,
  geofenceLoading,
  setGeofenceLoading,
  onSave,
  onClose,
}: Props) {
  const { toast } = useToast();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawLayerRef = useRef<L.LayerGroup | null>(null);
  const geofenceFormRef = useRef<any>(geofenceForm);
  const [redoPoints, setRedoPoints] = useState<Array<{ latitude: number; longitude: number }>>([]);

  const [patientLocation, setPatientLocation] = useState<PatientLocation | null>(null);
  useEffect(() => {
    geofenceFormRef.current = geofenceForm;
  }, [geofenceForm]);

  const points = useMemo(() => {
    if (!Array.isArray(geofenceForm?.points)) return [];
    return geofenceForm.points.filter(
      (p: any) =>
        p &&
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        isFinite(p.latitude) &&
        isFinite(p.longitude)
    );
  }, [geofenceForm]);

  const setPoints = (nextPoints: Array<{ latitude: number; longitude: number }>) => {
    const first = nextPoints[0];
    setGeofenceForm({
      ...geofenceFormRef.current,
      points: nextPoints,
      latitude: first?.latitude ?? geofenceFormRef.current.latitude ?? 0,
      longitude: first?.longitude ?? geofenceFormRef.current.longitude ?? 0,
      location_boundary: {
        type: 'polygon',
        points: nextPoints,
      },
      radius: undefined,
    });
  };

  const getInitialCenter = (): [number, number] => {
    if (points.length > 0) {
      return [points[0].latitude, points[0].longitude];
    }
    if (typeof geofenceForm?.latitude === 'number' && typeof geofenceForm?.longitude === 'number') {
    if (patientLocation) {
      return [patientLocation.latitude, patientLocation.longitude];
    }
      return [geofenceForm.latitude, geofenceForm.longitude];
    }
    return [6.9271, 79.8612];
  };

  useEffect(() => {
    if (!open || !geofenceForm?.is_geofencing || !mapContainerRef.current || mapRef.current) {
      return;
    }

    const [lat, lng] = getInitialCenter();
    const map = L.map(mapContainerRef.current).setView([lat, lng], 16);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 20,
    }).addTo(map);

    const drawLayer = L.layerGroup().addTo(map);
    drawLayerRef.current = drawLayer;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const current = geofenceFormRef.current;
      const currentPoints = Array.isArray(current.points) ? current.points : [];
      const nextPoints = [
        ...currentPoints,
        {
          latitude: Number(e.latlng.lat.toFixed(6)),
          longitude: Number(e.latlng.lng.toFixed(6)),
        },
      ];
      setPoints(nextPoints);
      setRedoPoints([]);
    });
  }, [open, geofenceForm?.is_geofencing, points]);

  useEffect(() => {
    if (!open || !mapRef.current || !drawLayerRef.current) return;

    drawLayerRef.current.clearLayers();

    points.forEach((p, idx) => {
      L.circleMarker([p.latitude, p.longitude], {
        radius: 6,
        color: '#b91c1c',
        weight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.95,
      })
        .bindTooltip(`Point ${idx + 1}`, { direction: 'top' })
        .addTo(drawLayerRef.current!);
    });

    if (points.length >= 2) {
      L.polyline(
        points.map((p) => [p.latitude, p.longitude] as [number, number]),
        {
          color: '#dc2626',
          weight: 2,
          dashArray: '4 4',
        }
      ).addTo(drawLayerRef.current);
    }

    if (points.length >= 3) {
      L.polygon(
        points.map((p) => [p.latitude, p.longitude] as [number, number]),
        {
          color: '#dc2626',
          weight: 2,
          fillColor: '#ef4444',
          fillOpacity: 0.25,
        }
      ).addTo(drawLayerRef.current);
    }
    // draw patient reference location as a blue marker (not part of polygon points)
    if (patientLocation) {
      L.circleMarker([patientLocation.latitude, patientLocation.longitude], {
        radius: 6,
        color: '#1e40af',
        weight: 2,
        fillColor: '#2563eb',
        fillOpacity: 0.95,
      })
        .bindTooltip('Patient location (reference)', { direction: 'top' })
        .addTo(drawLayerRef.current);
    }
  }, [open, points, patientLocation]);

  useEffect(() => {
    if (open) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      drawLayerRef.current = null;
    }
    setRedoPoints([]);
    setPatientLocation(null);
  }, [open]);

  useEffect(() => {
    if (!geofenceForm?.is_geofencing && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      drawLayerRef.current = null;
      setRedoPoints([]);
      setPatientLocation(null);
    }
  }, [geofenceForm?.is_geofencing]);

  const handleUseCurrentLocation = () => {
    if (!geofencePatient?.id) {
      toast({ title: 'Error', description: 'Patient not selected', variant: 'destructive' });
      return;
    }
    // Use browser/device geolocation instead of calling backend API
    setGeofenceLoading(true);
    if (!navigator?.geolocation) {
      toast({ title: 'Not supported', description: 'Geolocation is not available in this browser', variant: 'destructive' });
      setGeofenceLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;

        // Keep patient location as a reference (blue), do NOT add it to polygon points
        setPatientLocation({ latitude, longitude });
        setRedoPoints([]);

        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 17);
        }

        toast({
          title: 'Patient location loaded',
          description: 'Reference location set (blue). Click on map to add boundary points.',
        });
        setGeofenceLoading(false);
      },
      (err) => {
        toast({
          title: 'Location error',
          description: err?.message || 'Unable to get device location',
          variant: 'destructive',
        });
        setGeofenceLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Auto-load patient current location when dialog opens (only when geofencing enabled
  // and there are no existing polygon points or patientLocation)
  useEffect(() => {
    if (!open) return;
    if (!geofenceForm?.is_geofencing) return;
    if (!geofencePatient?.id) return;
    if (points.length > 0) return; // don't override existing points
    if (patientLocation) return; // already loaded

    handleUseCurrentLocation();
    // only run on open change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleUndo = () => {
    if (!points.length) return;
    const popped = points[points.length - 1];
    setRedoPoints((prev) => [...prev, popped]);
    setPoints(points.slice(0, -1));
  };

  const handleRedo = () => {
    if (!redoPoints.length) return;
    const next = redoPoints[redoPoints.length - 1];
    setRedoPoints((prev) => prev.slice(0, -1));
    setPoints([...points, next]);
  };

  const handleClearPoints = () => {
    if (!points.length) return;
    setRedoPoints([]);
    setPoints([]);
  };

  const handleSaveClick = () => {
    if (geofenceForm.is_geofencing && points.length < 3) {
      toast({
        title: 'Boundary incomplete',
        description: 'Add at least 3 points to define a polygon boundary.',
        variant: 'destructive',
      });
      return;
    }
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Geofence Settings for {geofencePatient?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Enable Geofencing</Label>
              <p className="text-xs text-muted-foreground mt-1">Define patient-safe zone using a polygon boundary</p>
            </div>
            <Switch
              checked={geofenceForm.is_geofencing}
              onCheckedChange={(checked) => setGeofenceForm({ ...geofenceForm, is_geofencing: checked })}
            />
          </div>

          {geofenceForm.is_geofencing && (
            <>
              <div className="border-t pt-4">
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Map className="w-4 h-4" />
                  Polygon Boundary
                </Label>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={handleUseCurrentLocation}
                    disabled={geofenceLoading}
                  >
                    {geofenceLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LocateFixed className="w-4 h-4 mr-2" />}
                    Load Patient Location
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-8" onClick={handleUndo} disabled={points.length === 0 || geofenceLoading}>
                      <Undo2 className="w-4 h-4 mr-1" />
                      Undo
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 h-8" onClick={handleRedo} disabled={redoPoints.length === 0 || geofenceLoading}>
                      <Redo2 className="w-4 h-4 mr-1" />
                      Redo
                    </Button>
                  </div>
                </div>

                <div
                  ref={mapContainerRef}
                  className="w-full h-64 rounded-lg border"
                />

                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">
                    Click the map to add points. Minimum 3 points required to create boundary.
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleClearPoints} disabled={points.length === 0 || geofenceLoading}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>

                <p className="text-xs mt-2">
                  Selected points: <span className="font-semibold">{points.length}</span>
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  When enabled, the system monitors the patient's location and alerts you when they move outside this red polygon boundary.
                </p>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={geofenceLoading}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSaveClick} disabled={geofenceLoading}>
              {geofenceLoading ? 'Fetching...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
