import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useGPSTracking } from '@/hooks/useGPSTracking';
import { useAuth } from '@/contexts/AuthContext';
import { formatTime } from '@/lib/datetime';

interface GPSTrackerProps {
  autoStart?: boolean;
}

const GPSTracker = ({ autoStart = false }: GPSTrackerProps) => {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(autoStart);
  const { location, error, isTracking } = useGPSTracking(user?.id, enabled);

  const toggleTracking = () => {
    setEnabled(!enabled);
  };

  return (
    <Card className="care-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            GPS Location Tracking
          </div>
          <Badge variant={isTracking ? "default" : "secondary"}>
            {isTracking ? 'Active' : 'Inactive'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {location && (
          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Latitude:</span>
                <span className="font-mono">{location.latitude.toFixed(6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Longitude:</span>
                <span className="font-mono">{location.longitude.toFixed(6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Accuracy:</span>
                <span className="font-mono">±{location.accuracy.toFixed(0)}m</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Update:</span>
                <span>{formatTime(location.timestamp)}</span>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="outline" className="w-full">
                <Navigation className="w-4 h-4 mr-2" />
                View on Map
              </Button>
            </a>
          </div>
        )}

        {!location && !error && isTracking && (
          <div className="text-center py-8 text-muted-foreground">
            <Navigation className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p className="text-sm">Acquiring GPS signal...</p>
          </div>
        )}

        <Button
          onClick={toggleTracking}
          variant={isTracking ? "destructive" : "default"}
          className="w-full"
        >
          {isTracking ? 'Stop Tracking' : 'Start Tracking'}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          {isTracking 
            ? 'Your location is being shared securely with your caregivers'
            : 'Enable GPS tracking to share your location with caregivers'
          }
        </p>
      </CardContent>
    </Card>
  );
};

export default GPSTracker;
