import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

export const useGPSTracking = (userId: string | undefined, enabled: boolean = false) => {
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!enabled || !userId) return;

    let watchId: number;

    const startTracking = () => {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser');
        toast({
          title: 'GPS Error',
          description: 'Your browser does not support geolocation',
          variant: 'destructive'
        });
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date()
          };

          setLocation(newLocation);
          setError(null);
          setIsTracking(true);

          // Save to database
          try {
            await api.post('/gps', {
              latitude: newLocation.latitude,
              longitude: newLocation.longitude,
              accuracy: newLocation.accuracy,
            });
          } catch (dbError) {
            console.error('Error saving GPS location:', dbError);
          }
        },
        (err) => {
          setError(err.message);
          setIsTracking(false);
          console.error('GPS error:', err);
          
          if (err.code === err.PERMISSION_DENIED) {
            toast({
              title: 'Permission Denied',
              description: 'Please enable location access to use GPS tracking',
              variant: 'destructive'
            });
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000
        }
      );
    };

    startTracking();

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setIsTracking(false);
      }
    };
  }, [enabled, userId]);

  return { location, error, isTracking };
};
