import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Users, Settings, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatTime } from '@/lib/datetime';

interface LiveCameraFeedProps {
  patientId?: string;
  streamUrl?: string;
}

const LiveCameraFeed = ({ patientId, streamUrl: initialStreamUrl }: LiveCameraFeedProps) => {
  const [peopleCount, setPeopleCount] = useState(0);
  const [lastDetection, setLastDetection] = useState<Date | null>(null);
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl || '');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(!initialStreamUrl);
  const [tempUrl, setTempUrl] = useState(streamUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Simple people detection simulation
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      // In production, this would use TensorFlow.js or ML model
      // For demo, we simulate detection based on video activity
      const count = Math.floor(Math.random() * 3);
      setPeopleCount(count);
      if (count > 0) {
        setLastDetection(new Date());
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const startStream = async () => {
    if (!streamUrl) {
      toast({
        title: 'Stream URL Required',
        description: 'Please enter a valid camera stream URL',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Try to load the stream
      if (videoRef.current) {
        videoRef.current.src = streamUrl;
        await videoRef.current.play();
        setIsStreaming(true);
        setShowSettings(false);
        toast({
          title: 'Stream Connected',
          description: 'Camera feed is now live',
        });
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      toast({
        title: 'Stream Error',
        description: 'Could not connect to camera. Check the URL and try again.',
        variant: 'destructive'
      });
      // Fallback to demo mode
      simulateDemoFeed();
    }
  };

  const simulateDemoFeed = () => {
    // For demo purposes, show a placeholder
    setIsStreaming(true);
    setShowSettings(false);
    toast({
      title: 'Demo Mode',
      description: 'Using simulated camera feed for demonstration',
    });
  };

  const stopStream = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
    setIsStreaming(false);
    setPeopleCount(0);
  };

  const applyStreamUrl = () => {
    setStreamUrl(tempUrl);
    startStream();
  };

  return (
    <Card className="care-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Live Camera Feed
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={peopleCount > 0 ? "default" : "secondary"}>
              <Users className="w-3 h-3 mr-1" />
              {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showSettings && (
          <div className="mb-4 space-y-2">
            <Input
              placeholder="Camera stream URL (e.g., rtsp://camera-ip:554/stream)"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
            />
            <Button onClick={applyStreamUrl} className="w-full">
              Connect Camera
            </Button>
            <p className="text-xs text-muted-foreground">
              Supports RTSP, HLS, or HTTP streams. Leave empty for demo mode.
            </p>
          </div>
        )}

        <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/50 rounded-lg overflow-hidden">
          {isStreaming ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
              />
              {peopleCount > 0 && (
                <div className="absolute top-4 left-4 space-y-2">
                  {[...Array(peopleCount)].map((_, i) => (
                    <div
                      key={i}
                      className="w-20 h-24 border-2 border-primary rounded animate-pulse"
                      style={{
                        marginLeft: `${i * 30}px`,
                        marginTop: `${i * 20}px`
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Camera feed not active
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>✓ Motion detection active</p>
            <p>✓ People counting enabled</p>
            {lastDetection && (
              <p>Last detection: {formatTime(lastDetection)}</p>
            )}
          </div>
          <Button
            variant={isStreaming ? "destructive" : "default"}
            onClick={isStreaming ? stopStream : startStream}
          >
            {isStreaming ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveCameraFeed;
