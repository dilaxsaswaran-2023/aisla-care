import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

interface QueuedLocation extends GPSLocation {
  retryCount: number;
  lastAttempt?: Date;
}

const LOCATION_INTERVAL = 60000; // 60 seconds
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [1000, 5000, 15000]; // 1s, 5s, 15s

export const useGPSTracking = (userId: string | undefined, enabled: boolean = false) => {
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const { toast } = useToast();

  const queueRef = useRef<QueuedLocation[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Process queued locations on interval
  const processQueue = async () => {
    if (queueRef.current.length === 0) return;

    const nextItem = queueRef.current[0];
    const timeSinceLastAttempt = nextItem.lastAttempt
      ? Date.now() - nextItem.lastAttempt.getTime()
      : Infinity;

    // Check retry backoff
    const backoffMs = RETRY_BACKOFF_MS[nextItem.retryCount] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
    if (timeSinceLastAttempt < backoffMs) {
      return; // Not ready to retry yet
    }

    try {
      console.log(
        `[GPS] Sending location (attempt ${nextItem.retryCount + 1}): ` +
        `lat=${nextItem.latitude.toFixed(4)}, lng=${nextItem.longitude.toFixed(4)}, ` +
        `accuracy=${nextItem.accuracy.toFixed(1)}m, time=${nextItem.timestamp.toISOString()}`
      );

      await api.post('/gps/patient/location', {
        patient_id: userId,
        latitude: nextItem.latitude,
        longitude: nextItem.longitude,
        accuracy: nextItem.accuracy,
        captured_at: nextItem.timestamp.toISOString(),
      });

      // Success: remove from queue
      console.log(`[GPS] Successfully sent location. Queue remaining: ${queueRef.current.length - 1}`);
      queueRef.current.shift();
      setQueuedCount(queueRef.current.length);
    } catch (err) {
      nextItem.retryCount += 1;
      nextItem.lastAttempt = new Date();

      console.warn(
        `[GPS] Failed to send location (attempt ${nextItem.retryCount}/${MAX_RETRIES}), ` +
        `will retry in ${RETRY_BACKOFF_MS[nextItem.retryCount] || 15000}ms. Error:`,
        err
      );

      if (nextItem.retryCount >= MAX_RETRIES) {
        console.error('[GPS] Max retries reached for location:', nextItem);
        queueRef.current.shift();
      }

      setQueuedCount(queueRef.current.length);
    }
  };

  // Get position and queue it
  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }

    console.log('[GPS] Requesting location from browser...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation: GPSLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(),
        };

        console.log(
          `[GPS] Location captured: lat=${newLocation.latitude.toFixed(4)}, ` +
          `lng=${newLocation.longitude.toFixed(4)}, accuracy=${newLocation.accuracy.toFixed(1)}m, ` +
          `time=${newLocation.timestamp.toISOString()}`
        );

        setLocation(newLocation);
        setError(null);
        setIsTracking(true);

        // Add to queue
        queueRef.current.push({
          ...newLocation,
          retryCount: 0,
        });
        setQueuedCount(queueRef.current.length);
        console.log(`[GPS] Added to queue. Queue size: ${queueRef.current.length}`);

        // Try to send immediately
        processQueue();
      },
      (err) => {
        setError(err.message);
        console.error('[GPS] Geolocation error:', err);

        if (err.code === err.PERMISSION_DENIED) {
          toast({
            title: 'Permission Denied',
            description: 'Please enable location access to use GPS tracking',
            variant: 'destructive',
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    if (!enabled || !userId) return;

    console.log('[GPS] Tracking enabled for user:', userId);

    // Initial capture
    captureLocation();

    // Set up interval
    intervalRef.current = setInterval(() => {
      console.log('[GPS] 60-second interval triggered, capturing location...');
      captureLocation();
      // Also process queue on each interval
      processQueue();
    }, LOCATION_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('[GPS] Tracking disabled');
      }
    };
  }, [enabled, userId]);

  // Process queue periodically for retries
  useEffect(() => {
    console.log('[GPS] Background retry timer started');
    const retryTimer = setInterval(() => {
      if (queueRef.current.length > 0) {
        console.log(`[GPS] Checking retry queue (${queueRef.current.length} pending)`);
      }
      processQueue();
    }, 2000); // Check queue every 2 seconds

    return () => {
      clearInterval(retryTimer);
      console.log('[GPS] Background retry timer stopped');
    };
  }, []);

  return {
    location,
    error,
    isTracking,
    queuedCount,
    processQueue, // Expose for manual retry
  };
};
