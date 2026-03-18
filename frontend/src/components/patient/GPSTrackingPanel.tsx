import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapPin, Wifi, Activity, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useGPSTracking } from '@/hooks/useGPSTracking';
import { useAuth } from '@/contexts/AuthContext';
import { formatTime } from '@/lib/datetime';

export const GPSTrackingPanel = () => {
  const { user } = useAuth();
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const { location, error, isTracking, queuedCount } = useGPSTracking(user?.id, trackingEnabled);

  // Only show for patients
  if (user?.role !== 'patient') {
    return null;
  }

  const handleToggle = (enabled: boolean) => {
    setTrackingEnabled(enabled);
    console.log('[GPS] Tracking toggle:', enabled ? 'ON' : 'OFF');
    if (enabled) {
      // Request permission if needed
      if (navigator.geolocation) {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then((result) => {
            console.log('[GPS] Permission status:', result.state);
            if (result.state === 'denied') {
              alert('Please enable location permissions in your browser settings');
            }
          })
          .catch(() => {
            // Fallback for browsers that don't support permissions API
          });
      }
    }
  };

  return (
    <Card className="care-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">GPS Location Tracking</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Send your location every 60 seconds to caregivers
              </p>
            </div>
          </div>
          <Switch
            checked={trackingEnabled}
            onCheckedChange={handleToggle}
            disabled={!user}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Section */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
          <div className="flex items-center gap-2">
            {trackingEnabled ? (
              <>
                {isTracking ? (
                  <Badge variant="default" className="gap-1.5 bg-green-600">
                    <Activity className="w-3 h-3 animate-pulse" />
                    Tracking Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1.5">
                    <Clock className="w-3 h-3" />
                    Initializing
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="outline" className="gap-1.5">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                Disabled
              </Badge>
            )}
          </div>
        </div>

        {/* Location Info */}
        {location ? (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Latitude</p>
              <p className="text-sm font-monospace font-semibold">
                {location.latitude.toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Longitude</p>
              <p className="text-sm font-monospace font-semibold">
                {location.longitude.toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Accuracy</p>
              <p className="text-sm font-semibold text-blue-600">
                ±{location.accuracy.toFixed(1)}m
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Last Update</p>
              <p className="text-sm font-semibold">
                {formatTime(location.timestamp)}
              </p>
            </div>
          </div>
        ) : trackingEnabled ? (
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">
              Getting location...
            </p>
          </div>
        ) : null}

        {/* Queue Info */}
        {queuedCount > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <Wifi className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-yellow-800">
                {queuedCount} location{queuedCount === 1 ? '' : 's'} queued
              </p>
              <p className="text-xs text-yellow-700 mt-0.5">
                Will retry when network is available
              </p>
            </div>
          </div>
        )}

        {/* Errors */}
        {error && trackingEnabled && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-800">GPS Error</p>
              <p className="text-xs text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-1">How it works</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Location captured every 60 seconds</li>
                <li>Duplicates automatically ignored</li>
                <li>Offline queue with automatic retry</li>
                <li>Battery optimized with interruption safety</li>
              </ul>
            </div>
          </div>
        </div>

        {!user && (
          <div className="p-3 rounded-lg bg-muted border border-border">
            <p className="text-xs text-muted-foreground">
              Sign in to enable location tracking
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
