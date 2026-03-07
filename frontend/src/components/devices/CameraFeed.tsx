import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Camera, Users, Wifi, AlertCircle } from 'lucide-react';

interface CameraFeedProps {
  patientId?: string;
}

const feeds = [
  { 
    id: 1, 
    name: 'Living Room (DEMO)', 
    status: 'online',
    stream: 'https://www.youtube.com/embed/HpZAez2oYsA?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    type: 'youtube'
  },
  { 
    id: 2, 
    name: 'Front Door (DEMO)', 
    status: 'online',
    stream: 'https://www.youtube.com/embed/rnXIjl_Rzy4?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    type: 'youtube'
  },
  { 
    id: 3, 
    name: 'Kitchen (DEMO)', 
    status: 'offline',
    stream: '',
    type: 'none'
  },
  { 
    id: 4, 
    name: 'Garden (DEMO)', 
    status: 'online',
    stream: 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/TearsOfSteel.mp4',
    type: 'mp4'
  },
];

const CameraFeed = ({ patientId }: CameraFeedProps) => {
  const [peopleCount, setPeopleCount] = useState(0);
  const [lastDetection, setLastDetection] = useState<Date | null>(null);
  const [loadErrors, setLoadErrors] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const count = Math.floor(Math.random() * 3);
      setPeopleCount(count);
      if (count > 0) setLastDetection(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMediaError = (feedId: number) => {
    setLoadErrors(prev => ({ ...prev, [feedId]: true }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {feeds.map((feed) => (
          <div key={feed.id} className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border">
            {feed.status === 'online' && !loadErrors[feed.id] ? (
              <>
                {(feed.type === 'mp4') && (
                  <video
                    src={feed.stream}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    controlsList="nodownload"
                    onError={() => handleMediaError(feed.id)}
                  />
                )}
                {(feed.type === 'youtube') && (
                  <iframe
                    src={feed.stream}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <div className="text-center space-y-2">
                  {loadErrors[feed.id] ? (
                    <>
                      <AlertCircle className="w-8 h-8 mx-auto text-destructive/40" />
                      <p className="text-xs text-muted-foreground">Stream unavailable</p>
                    </>
                  ) : (
                    <>
                      <Camera className="w-8 h-8 mx-auto text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">{feed.name}</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="absolute top-2 left-2">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-black px-2 py-1">
                <span className={`status-dot ${feed.status === 'online' ? 'status-dot-online' : 'status-dot-offline'}`} />
                <span className="text-[10px] font-medium text-white">{feed.name}</span>
              </div>
            </div>

            <div className="absolute top-2 right-2">
              <Badge variant={feed.status === 'online' ? 'default' : 'secondary'} className="text-[10px] gap-1">
                <Wifi className="w-3 h-3" />{feed.status}
              </Badge>
            </div>

            {feed.status === 'online' && feed.id === 1 && peopleCount > 0 && (
              <div className="absolute bottom-2 left-2">
                <Badge className="text-[10px] gap-1"><Users className="w-3 h-3" />{peopleCount} detected</Badge>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-4">
          <span>✓ Motion detection active</span>
          <span>✓ People counting enabled</span>
        </div>
        {lastDetection && <span>Last detection: {lastDetection.toLocaleTimeString()}</span>}
      </div>
      <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
        <p><strong>Demo Streams:</strong> Living Room uses a YouTube Live embed. Front Door and Garden use public MP4 samples. Kitchen is offline.</p>
      </div>
    </div>
  );
};

export default CameraFeed;