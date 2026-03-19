import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, MessageSquare, Phone, X, ChevronRight } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime } from '@/lib/datetime';

interface AlertItem {
  id: string;
  alert_type: string;
  status: string;
  priority?: string;
  title: string;
  message: string;
  voice_transcription?: string;
  patient_name?: string;
  patient_id?: string;
  created_at: string;
  source?: string;
  is_read?: boolean;
  is_added_to_emergency?: boolean;
  is_acknowledged?: boolean;
  acknowledged_via?: string | null;
  patient_phone_country?: string | null;
  patient_phone_number?: string | null;
}

interface MessageContact {
  id: string;
  name: string;
  role?: string;
  patient_name?: string | null;
}

interface EmergencyBannerProps {
  alert: AlertItem | null;
  onClose: () => void;
  onAcknowledge: (how: string) => Promise<void>;
  onOpenMessages: () => void;
  onOpenMessageWith?: (partnerId: string) => void;
  messageContacts?: MessageContact[];
  userRole?: string;
}

export const EmergencyBanner = ({ 
  alert, 
  onClose, 
  onAcknowledge, 
  onOpenMessages,
  onOpenMessageWith,
  messageContacts = [],
  userRole = ""
}: EmergencyBannerProps) => {
  const [followupOpen, setFollowupOpen] = useState(false);
  const [messageSubmenuOpen, setMessageSubmenuOpen] = useState(false);
  const [savingHow, setSavingHow] = useState<string | null>(null);

  if (!alert) return null;

  // Get contacts for this patient based on user role
  const relevantContacts = useMemo(() => {
    if (!alert.patient_name) return [];
    
    // Filter contacts that match this patient
    const patientContacts = messageContacts.filter(c => c.patient_name === alert.patient_name);
    
    // Filter based on user role
    if (userRole.toLowerCase() === "caregiver") {
      // Caregiver can message: patient and family members
      return patientContacts.filter(c => !c.role || c.role.toLowerCase() !== "caregiver");
    } else if (userRole.toLowerCase() === "family") {
      // Family can message: patient and caregiver
      return patientContacts.filter(c => !c.role || c.role.toLowerCase() !== "family");
    }
    
    return patientContacts;
  }, [messageContacts, alert.patient_name, userRole]);

  const alertTypeLabel = alert.alert_type;
  const normalizedType = (alert.alert_type || "").toLowerCase();
  const normalizedSource = (alert.source || "").toLowerCase();

  const followUpMode = useMemo(() => {
    if (normalizedSource === "budii") {
      return {
        title: "Emergency Escalation Follow-up",
        description: "Budii detected a serious event. Choose how you are handling this right now.",
      };
    }
    if (normalizedType.includes("geofence")) {
      return {
        title: "Geofence Breach Follow-up",
        description: "Confirm outreach to the patient and document your immediate response.",
      };
    }
    if (normalizedType.includes("sos")) {
      return {
        title: "SOS Follow-up",
        description: "Record the action taken for this SOS alert.",
      };
    }
    return {
      title: "Alert Follow-up",
      description: "Acknowledge and track how this emergency alert is being handled.",
    };
  }, [normalizedSource, normalizedType]);

  const phoneNumber = [alert.patient_phone_country, alert.patient_phone_number]
    .filter((part) => !!part)
    .join("");

  const handleAcknowledge = async (how: string) => {
    setSavingHow(how);
    try {
      await onAcknowledge(how);
      if (how === "message") {
        // If there are multiple contacts, show submenu instead of directly opening messages
        if (relevantContacts.length > 1) {
          setMessageSubmenuOpen(true);
        } else if (relevantContacts.length === 1) {
          // If only one contact, open message with that contact
          onOpenMessageWith?.(relevantContacts[0].id);
          onOpenMessages();
        } else {
          // Fallback: just open messages tab
          onOpenMessages();
        }
      }
      // Don't close followup modal yet if we're showing message submenu
      if (how !== "message" || relevantContacts.length <= 1) {
        setFollowupOpen(false);
      }
    } finally {
      setSavingHow(null);
    }
  };

  const handleMessageContact = async (contactId: string, contactName: string) => {
    // Acknowledge as message
    setSavingHow("message");
    try {
      await onAcknowledge("message");
      onOpenMessageWith?.(contactId);
      onOpenMessages();
      setFollowupOpen(false);
      setMessageSubmenuOpen(false);
    } finally {
      setSavingHow(null);
    }
  };

  const handleCallAndAcknowledge = async () => {
    if (!phoneNumber) return;
    await handleAcknowledge("call");
    window.location.href = `tel:${phoneNumber}`;
  };

  return (
    <>
      <div className="rounded-2xl border border-destructive/30 bg-gradient-to-r from-destructive/10 via-background to-background p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-destructive text-sm mb-1 tracking-wide">
                {alertTypeLabel}
              </div>
              <div className="text-foreground font-semibold text-sm break-words">
                {alert.patient_name ? `${alert.patient_name}: ` : ''}{alert.title}
              </div>
              <div className="text-muted-foreground text-xs mt-1 break-words">
                {alert.message}
              </div>
              {alert.voice_transcription && (
                <div className="text-muted-foreground text-xs italic mt-1 break-words">
                  📝 {alert.voice_transcription}
                </div>
              )}
              <div className="text-destructive/80 text-xs mt-1">
                {formatTime(alert.created_at)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => setFollowupOpen(true)}
                  disabled={!!alert.is_acknowledged}
                >
                  Follow up
                </Button>
                {alert.is_acknowledged ? (
                  <Badge className="bg-green-100 text-green-800 border border-green-300">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Acknowledged via {alert.acknowledged_via || "manual"}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="flex-shrink-0 text-destructive hover:bg-destructive/10"
            title="Close banner"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={followupOpen} onOpenChange={setFollowupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{followUpMode.title}</DialogTitle>
            <DialogDescription>{followUpMode.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Button
              variant="outline"
              className="justify-start"
              disabled={!phoneNumber || !!savingHow}
              onClick={handleCallAndAcknowledge}
            >
              <Phone className="w-4 h-4 mr-2" />
              Call patient {phoneNumber ? `(${phoneNumber})` : "(no phone available)"}
            </Button>

            {/* Message button with conditional behavior */}
            {relevantContacts.length > 1 ? (
              <Button
                variant="outline"
                className="justify-between"
                disabled={!!savingHow}
                onClick={() => setMessageSubmenuOpen(true)}
              >
                <span className="flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Message care team and acknowledge
                </span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : relevantContacts.length === 1 ? (
              <Button
                variant="outline"
                className="justify-start"
                disabled={!!savingHow}
                onClick={() => handleMessageContact(relevantContacts[0].id, relevantContacts[0].name)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Message {relevantContacts[0].name} and acknowledge
              </Button>
            ) : (
              <Button
                variant="outline"
                className="justify-start"
                disabled={!!savingHow}
                onClick={() => handleAcknowledge("message")}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Message care team and acknowledge
              </Button>
            )}

            <Button
              className="justify-start"
              disabled={!!savingHow}
              onClick={() => handleAcknowledge("manual_followup")}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark as acknowledged (manual follow-up)
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFollowupOpen(false)} disabled={!!savingHow}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message contact selection submenu */}
      <Dialog open={messageSubmenuOpen} onOpenChange={setMessageSubmenuOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Contact</DialogTitle>
            <DialogDescription>Who would you like to message?</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {relevantContacts.map((contact) => (
              <Button
                key={contact.id}
                variant="outline"
                className="justify-start h-auto py-3"
                disabled={!!savingHow}
                onClick={() => handleMessageContact(contact.id, contact.name)}
              >
                <div className="text-left">
                  <div className="font-semibold text-sm">{contact.name}</div>
                  {contact.role && (
                    <div className="text-xs text-muted-foreground capitalize">{contact.role}</div>
                  )}
                </div>
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMessageSubmenuOpen(false)} disabled={!!savingHow}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

