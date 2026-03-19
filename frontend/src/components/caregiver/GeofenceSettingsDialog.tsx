import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Map as MapIcon, Loader2, Undo2, Redo2, Trash2, LocateFixed } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Map as PigeonMap, Overlay, GeoJson, ZoomControl } from 'pigeon-maps';

interface Patient {
  id: string;
  full_name: string;
}

interface PatientLocation {
  latitude: number;
  longitude: number;
}

interface GeoPoint {
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

type LatLng = [number, number];

const DEFAULT_CENTER: LatLng = [6.9271, 79.8612];

const osmTileProvider = (x: number, y: number, z: number): string => {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
};

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
  const geofenceFormRef = useRef<any>(geofenceForm);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);

  const [redoPoints, setRedoPoints] = useState<GeoPoint[]>([]);
  const [patientLocation, setPatientLocation] = useState<PatientLocation | null>(null);
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState<number>(16);
  const [mapWidth, setMapWidth] = useState<number>(900);

  useEffect(() => {
    geofenceFormRef.current = geofenceForm;
  }, [geofenceForm]);

  useEffect(() => {
    if (!mapWrapperRef.current) return;

    const updateSize = () => {
      if (!mapWrapperRef.current) return;
      const width = mapWrapperRef.current.clientWidth;
      if (width > 0) setMapWidth(width * 1.2);
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(mapWrapperRef.current);

    return () => observer.disconnect();
  }, [open]);

  const points = useMemo<GeoPoint[]>(() => {
    if (!Array.isArray(geofenceForm?.points)) return [];

    return geofenceForm.points.filter(
      (p: any) =>
        p &&
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude)
    );
  }, [geofenceForm]);

  const pointSize = useMemo(() => {
    const min = 6;
    const max = 20;
    const size = zoom * 0.8;

    return Math.max(min, Math.min(max, Math.round(size)));
  }, [zoom]);

  const referencePointSize = useMemo(() => {
    return pointSize + 2;
  }, [pointSize]);

  const getInitialCenter = (): LatLng => {
    if (points.length > 0) {
      return [points[0].latitude, points[0].longitude];
    }

    if (patientLocation) {
      return [patientLocation.latitude, patientLocation.longitude];
    }

    if (
      typeof geofenceForm?.latitude === 'number' &&
      typeof geofenceForm?.longitude === 'number'
    ) {
      return [geofenceForm.latitude, geofenceForm.longitude];
    }

    return DEFAULT_CENTER;
  };

  const setPoints = (nextPoints: GeoPoint[]) => {
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

  useEffect(() => {
    if (!open) return;
    if (!geofenceForm?.is_geofencing) return;

    setCenter(getInitialCenter());
    setZoom(16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, geofenceForm?.is_geofencing]);

  useEffect(() => {
    if (!open) {
      setRedoPoints([]);
      setPatientLocation(null);
    }
  }, [open]);

  useEffect(() => {
    if (!geofenceForm?.is_geofencing) {
      setRedoPoints([]);
      setPatientLocation(null);
    }
  }, [geofenceForm?.is_geofencing]);

  const handleMapClick = ({ latLng }: { latLng: LatLng }) => {
    const [lat, lng] = latLng;
    const current = geofenceFormRef.current;
    const currentPoints = Array.isArray(current.points) ? current.points : [];

    const nextPoints: GeoPoint[] = [
      ...currentPoints,
      {
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
      },
    ];

    setPoints(nextPoints);
    setRedoPoints([]);
  };

  const handleUseCurrentLocation = () => {
    if (!geofencePatient?.id) {
      toast({
        title: 'Error',
        description: 'Patient not selected',
        variant: 'destructive',
      });
      return;
    }

    setGeofenceLoading(true);

    if (!navigator?.geolocation) {
      toast({
        title: 'Not supported',
        description: 'Geolocation is not available in this browser',
        variant: 'destructive',
      });
      setGeofenceLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;

        setPatientLocation({ latitude, longitude });
        setCenter([latitude, longitude]);
        setZoom(17);
        setRedoPoints([]);

        toast({
          title: 'Location loaded',
          description: 'Blue marker is the reference location. Click map to add polygon points.',
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

  useEffect(() => {
    if (!open) return;
    if (!geofenceForm?.is_geofencing) return;
    if (!geofencePatient?.id) return;
    if (points.length > 0) return;
    if (patientLocation) return;

    handleUseCurrentLocation();
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

  const geoJsonData = useMemo(() => {
    const features: any[] = [];

    if (points.length >= 3) {
      const ring = points.map((p) => [p.longitude, p.latitude]);
      const first = ring[0];
      const last = ring[ring.length - 1];

      const closedRing =
        first && last && (first[0] !== last[0] || first[1] !== last[1])
          ? [...ring, first]
          : ring;

      features.push({
        type: 'Feature',
        properties: { kind: 'polygon' },
        geometry: {
          type: 'Polygon',
          coordinates: [closedRing],
        },
      });
    } else if (points.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { kind: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: points.map((p) => [p.longitude, p.latitude]),
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [points]);

  const pointMarker = (colorClasses: string, size: number) => (
    <div
      className="flex items-center justify-center"
      style={{
        width: size,
        height: size,
      }}
    >
      <div
        className={`rounded-full border-2 shadow ${colorClasses}`}
        style={{
          width: size,
          height: size,
        }}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[50vw] h-max-[90vh] max-w-none border-border/60 bg-background/95 shadow-lg backdrop-blur-sm flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Geofence Settings for {geofencePatient?.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto pr-4">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm">
            <div>
              <Label className="text-sm font-medium">Enable Geofencing</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Define patient-safe zone using a polygon boundary
              </p>
            </div>

            <Switch
              checked={geofenceForm.is_geofencing}
              onCheckedChange={(checked) =>
                setGeofenceForm({
                  ...geofenceFormRef.current,
                  is_geofencing: checked,
                })
              }
            />
          </div>

          {geofenceForm.is_geofencing && (
            <div className="border-t border-border/60 pt-4">
              <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                <MapIcon className="w-4 h-4" />
                Polygon Boundary
              </Label>

              <div
                ref={mapWrapperRef}
                className="relative w-full h-[300px] rounded-xl border border-border/60 bg-background/70 overflow-hidden"
              >
                <div className="absolute top-3 left-12 right-3 z-[1000] flex flex-wrap gap-2 pointer-events-none">
                  <div className="pointer-events-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 shadow-sm"
                      onClick={handleUseCurrentLocation}
                      disabled={geofenceLoading}
                    >
                      {geofenceLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <LocateFixed className="w-4 h-4 mr-0" />
                      )}
                      Current Location
                    </Button>
                  </div>

                  <div className="pointer-events-auto flex gap-2 ml-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 shadow-sm"
                      onClick={handleUndo}
                      disabled={points.length === 0 || geofenceLoading}
                    >
                      <Undo2 className="w-4 h-4 mr-1" />
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 shadow-sm"
                      onClick={handleRedo}
                      disabled={redoPoints.length === 0 || geofenceLoading}
                    >
                      <Redo2 className="w-4 h-4 mr-1" />
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 shadow-sm"
                      onClick={handleClearPoints}
                      disabled={points.length === 0 || geofenceLoading}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                    </Button>
                  </div>
                </div>

                <PigeonMap
                  center={center}
                  zoom={zoom}
                  minZoom={3}
                  maxZoom={18}
                  width={mapWidth}
                  height={400}
                  onClick={handleMapClick}
                  onBoundsChanged={({ center, zoom }) => {
                    setCenter(center as LatLng);
                    setZoom(zoom);
                  }}
                  provider={osmTileProvider}
                >
                  <ZoomControl />

                  {geoJsonData.features.length > 0 && (
                    <GeoJson
                      data={geoJsonData as any}
                      styleCallback={(feature: any) => {
                        if (feature?.properties?.kind === 'line') {
                          return {
                            stroke: '#dc2626',
                            strokeWidth: 3,
                            fill: 'none',
                            strokeDasharray: '5 5',
                          };
                        }

                        if (feature?.properties?.kind === 'polygon') {
                          return {
                            stroke: '#dc2626',
                            strokeWidth: 3,
                            fill: '#ef4444',
                            fillOpacity: 0.2,
                          };
                        }

                        return {};
                      }}
                    />
                  )}

                  {points.map((p, idx) => (
                    <Overlay
                      key={`${p.latitude}-${p.longitude}-${idx}`}
                      anchor={[p.latitude, p.longitude]}
                      offset={[pointSize / 2, pointSize / 2]}
                    >
                      {pointMarker('bg-red-500 border-red-700', pointSize)}
                    </Overlay>
                  ))}

                  {patientLocation && (
                    <Overlay
                      anchor={[patientLocation.latitude, patientLocation.longitude]}
                      offset={[referencePointSize / 2, referencePointSize / 2]}
                    >
                      {pointMarker('bg-blue-500 border-blue-700', referencePointSize)}
                    </Overlay>
                  )}
                </PigeonMap>

                <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-background/90 px-3 py-2 text-xs shadow-sm border pointer-events-none">
                  <p className="text-muted-foreground">
                    Minimum 3 points required
                  </p>
                </div>

                <div className="absolute bottom-3 right-3 z-[1000] rounded-lg bg-background/90 px-3 py-2 text-xs shadow-sm border pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500 border border-red-700" />
                    <span>Boundary point</span>
                  </div>
                  {patientLocation && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block h-3 w-3 rounded-full bg-blue-500 border border-blue-700" />
                      <span>Reference location</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-xs">
                  Selected points: <span className="font-semibold">{points.length}</span>
                </p>
                {patientLocation && (
                  <p className="text-xs text-muted-foreground">
                    Blue marker = reference location
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 flex-shrink-0">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={geofenceLoading}
            >
              Cancel
            </Button>

            <Button
              className="flex-1"
              onClick={handleSaveClick}
              disabled={geofenceLoading}
            >
              {geofenceLoading ? 'Fetching...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}