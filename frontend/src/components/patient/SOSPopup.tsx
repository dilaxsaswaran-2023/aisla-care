import { useState, useRef, useEffect } from "react";
import { AlertCircle, Mic } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface SOSPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOSPopup = ({ isOpen, onClose }: SOSPopupProps) => {
  const [timeLeft, setTimeLeft] = useState(8);
  const [transcription, setTranscription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const transcriptionRef = useRef("");
  const { toast } = useToast();

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
        console.log("Voice recognition started");
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            final += transcript + " ";
          } else {
            interim += transcript;
          }
        }

        // Update the reference (always)
        if (final) {
          transcriptionRef.current += final;
        }
        
        // Show combined result
        const display = transcriptionRef.current + interim;
        setTranscription(display.trim());
      };

      recognition.onerror = (event: any) => {
        console.error("Voice recognition error:", event.error);
      };

      recognition.onend = () => {
        setIsRecording(false);
        console.log("Voice recognition ended");
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Web Speech API not supported in this browser");
      toast({
        title: "Browser not supported",
        description: "Voice recording requires Chrome, Edge, or Safari",
        variant: "destructive",
      });
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast]);

  // Auto-start recording and send SOS after 8 seconds
  useEffect(() => {
    if (!isOpen) return;

    // Start recording immediately
    if (recognitionRef.current && !isRecording) {
      transcriptionRef.current = "";
      setTranscription("");
      setTimeLeft(8);
      recognitionRef.current.start();
    }

    // Timer for countdown and auto-send
    const startTimer = () => {
      timerRef.current = setTimeout(() => {
        if (timeLeft > 1) {
          setTimeLeft(timeLeft - 1);
        } else {
          // 8 seconds elapsed - stop recording and send SOS
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
          handleAutoSOS();
        }
      }, 1000);
    };

    startTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isOpen, timeLeft]);

  const handleAutoSOS = async () => {
    setIsLoading(true);
    try {
      const finalTranscription = transcriptionRef.current.trim();
      
      await api.post("/sos-alerts", {
        voice_transcription: finalTranscription || null,
      });

      toast({
        title: "SOS Alert Sent!",
        description: finalTranscription 
          ? `Your emergency message has been sent: "${finalTranscription}"`
          : "Your caregiver has been notified and will contact you soon.",
        variant: "destructive",
      });

      // Reset and close
      transcriptionRef.current = "";
      setTranscription("");
      setTimeLeft(8);
      setIsRecording(false);
      onClose();
    } catch (error) {
      console.error("SOS error:", error);
      toast({
        title: "Error",
        description: "Failed to send SOS alert. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    transcriptionRef.current = "";
    setTranscription("");
    setTimeLeft(8);
    setIsRecording(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            SOS Emergency Alert
          </DialogTitle>
          <DialogDescription>
            Listening to your emergency situation. Your message will be sent automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recording Status with Countdown */}
          <div className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5">
            <div className="mb-4 w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
              <Mic className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-lg font-semibold text-destructive">Listening...</p>
            <p className="text-5xl font-bold text-primary mt-4 tabular-nums">{timeLeft}</p>
            <p className="text-xs text-muted-foreground mt-2">seconds remaining</p>
          </div>

          {/* Transcription Display */}
          <div className="min-h-16 p-3 rounded-lg bg-secondary/20 border border-secondary">
            <p className="text-xs font-semibold text-muted-foreground mb-2">What we heard:</p>
            <p className="text-sm text-foreground leading-relaxed">
              {transcription || <span className="text-muted-foreground italic">Waiting for speech...</span>}
            </p>
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground text-center">
            • Recording automatically sends in {timeLeft} seconds
            <br />
            • Your voice is being transcribed to text
            <br />
            • Your location will be included
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SOSPopup;
