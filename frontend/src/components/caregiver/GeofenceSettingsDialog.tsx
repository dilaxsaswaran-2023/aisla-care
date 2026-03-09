import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Map, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Patient {
  id: string;
  full_name: string;
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

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      toast({ title: 'Error', description: 'Geolocation not supported by this browser', variant: 'destructive' });
      return;
    }
    try {
      // show loading state via setGeofenceLoading
      setGeofenceLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setGeofenceForm({ ...geofenceForm, latitude, longitude });
          toast({ title: 'Location set', description: 'Device location applied to latitude/longitude' });
          setGeofenceLoading(false);
        },
        (err) => {
          toast({ title: 'Location error', description: err.message || 'Unable to get device location', variant: 'destructive' });
          setGeofenceLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch (err: any) {
      toast({ title: 'Location error', description: err?.message || 'Unable to get device location', variant: 'destructive' });
      setGeofenceLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Geofence Settings for {geofencePatient?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Enable Geofencing</Label>
              <p className="text-xs text-muted-foreground mt-1">Monitor patient location boundary</p>
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
                  Location Boundary
                </Label>

                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <Label className="text-xs text-muted-foreground">Latitude</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 40.7128"
                      value={geofenceForm.latitude}
                      onChange={(e) => setGeofenceForm({ ...geofenceForm, latitude: parseFloat(e.target.value) || 0 })}
                      step="0.0001"
                      min="-90"
                      max="90"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Range: -90 to 90</p>
                  </div>

                  <div className="col-span-6">
                    <Label className="text-xs text-muted-foreground">Longitude</Label>
                    <Input
                      type="number"
                      placeholder="e.g., -74.0060"
                      value={geofenceForm.longitude}
                      onChange={(e) => setGeofenceForm({ ...geofenceForm, longitude: parseFloat(e.target.value) || 0 })}
                      step="0.0001"
                      min="-180"
                      max="180"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Range: -180 to 180</p>
                  </div>
                </div>

                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full h-8 flex items-center justify-center" onClick={handleUseCurrentLocation} disabled={geofenceLoading}>
                    {geofenceLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Use current location
                  </Button>
                </div>

                <div className="mt-4">
                  <Label className="text-xs text-muted-foreground">Boundary Radius (meters)</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <Input
                      type="range"
                      min="5"
                      max="500"
                      step="1"
                      value={geofenceForm.radius}
                      onChange={(e) => setGeofenceForm({ ...geofenceForm, radius: parseInt(e.target.value, 10) })}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-16">{geofenceForm.radius}m</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Range: 5 to 500 meters</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  ℹ️ When enabled, the system will monitor the patient's location and alert you if they leave the designated boundary area.
                </p>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={geofenceLoading}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={onSave} disabled={geofenceLoading}>
              {geofenceLoading ? 'Fetching...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
