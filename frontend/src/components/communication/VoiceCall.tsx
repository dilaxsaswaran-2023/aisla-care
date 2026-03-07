import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/contexts/AuthContext";

interface VoiceCallProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
}

const VoiceCall = ({ recipientId, recipientName, onClose }: VoiceCallProps) => {
  const { user } = useAuth();
  const [callDuration, setCallDuration] = useState(0);
  const { toast } = useToast();
  
  const { isCallActive, isMuted, startCall, endCall, toggleMute } = useWebRTC({
    recipientId,
    userId: user?.id || '',
    onCallStarted: () => {
      toast({
        title: "Call Connected",
        description: `Connected to ${recipientName}`,
      });
    },
    onCallEnded: () => {
      toast({
        title: "Call Ended",
        description: "Call has been disconnected",
      });
      onClose();
    }
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  const handleStartCall = async () => {
    try {
      await startCall(true);
    } catch (error) {
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to make calls",
        variant: "destructive",
      });
    }
  };

  const handleEndCall = () => {
    endCall();
    setCallDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="care-card max-w-md mx-auto">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary-glow/10 border-b border-care-border">
        <CardTitle className="text-center">
          {isCallActive ? `Call with ${recipientName}` : "Voice Call"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-primary">
              {recipientName.charAt(0)}
            </span>
          </div>

          {/* Status */}
          <div className="text-center">
            <h3 className="text-xl font-semibold">{recipientName}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isCallActive ? formatDuration(callDuration) : "Tap to call"}
            </p>
          </div>

          {/* Call Controls */}
          {isCallActive ? (
            <div className="flex items-center gap-4">
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="lg"
                className="rounded-full w-16 h-16"
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                className="rounded-full w-20 h-20"
                onClick={handleEndCall}
              >
                <PhoneOff className="w-8 h-8" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-4">
              <Button
                size="lg"
                className="rounded-full w-20 h-20 bg-success hover:bg-success/90"
                onClick={handleStartCall}
              >
                <Phone className="w-8 h-8" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full w-20 h-20"
                onClick={onClose}
              >
                <PhoneOff className="w-8 h-8" />
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground max-w-xs">
            {isCallActive 
              ? "Real WebRTC voice call is active. Audio is encrypted peer-to-peer."
              : "Start a secure voice call with WebRTC technology."
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceCall;
