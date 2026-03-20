import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Phone,
  X,
  ChevronRight,
  Siren,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatTime } from "@/lib/datetime";

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

const formatAlertType = (value?: string) =>
  (value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getAlertTone = (alert?: AlertItem | null) => {
  const type = (alert?.alert_type || "").toLowerCase();
  const priority = (alert?.priority || "").toLowerCase();
  const source = (alert?.source || "").toLowerCase();

  if (type.includes("sos") || priority === "critical" || source === "budii") {
    return {
      shell:
        "from-red-600/42 via-rose-500/24 to-red-200/55 dark:from-red-500/35 dark:via-rose-500/22 dark:to-red-950/45",
      panel:
        "bg-gradient-to-br from-white via-red-50/95 to-rose-100/85 dark:from-zinc-950 dark:via-red-950/45 dark:to-rose-950/35",
      icon:
        "border-red-400 bg-red-100 text-red-700 shadow-[0_18px_38px_-16px_rgba(239,68,68,0.72)] dark:border-red-800 dark:bg-red-950/70 dark:text-red-300",
      glow: "bg-red-500/35",
      badge: "destructive" as const,
    };
  }

  if (type.includes("geofence")) {
    return {
      shell:
        "from-orange-500/34 via-red-500/18 to-amber-100/45 dark:from-orange-500/30 dark:via-red-500/18 dark:to-amber-950/35",
      panel:
        "bg-gradient-to-br from-white via-orange-50/85 to-amber-50/75 dark:from-zinc-950 dark:via-orange-950/40 dark:to-amber-950/30",
      icon:
        "border-orange-300 bg-orange-100 text-orange-700 shadow-[0_16px_36px_-16px_rgba(249,115,22,0.62)] dark:border-orange-800 dark:bg-orange-950/65 dark:text-orange-300",
      glow: "bg-orange-500/30",
      badge: "secondary" as const,
    };
  }

  return {
    shell:
      "from-rose-500/30 via-red-500/16 to-rose-100/45 dark:from-rose-500/26 dark:via-red-500/16 dark:to-rose-950/34",
    panel:
      "bg-gradient-to-br from-white via-rose-50/82 to-red-50/72 dark:from-zinc-950 dark:via-rose-950/38 dark:to-red-950/28",
    icon:
      "border-rose-300 bg-rose-100 text-rose-700 shadow-[0_14px_34px_-14px_rgba(244,63,94,0.58)] dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    glow: "bg-rose-500/28",
    badge: "outline" as const,
  };
};

export const EmergencyBanner = ({
  alert,
  onClose,
  onAcknowledge,
  onOpenMessages,
  onOpenMessageWith,
  messageContacts = [],
  userRole = "",
}: EmergencyBannerProps) => {
  const [followupOpen, setFollowupOpen] = useState(false);
  const [messageSubmenuOpen, setMessageSubmenuOpen] = useState(false);
  const [savingHow, setSavingHow] = useState<string | null>(null);

  const relevantContacts = useMemo(() => {
    if (!alert?.patient_name) return [];

    const patientContacts = messageContacts.filter((c) => c.patient_name === alert.patient_name);

    if (userRole.toLowerCase() === "caregiver") {
      return patientContacts.filter((c) => !c.role || c.role.toLowerCase() !== "caregiver");
    }

    if (userRole.toLowerCase() === "family") {
      return patientContacts.filter((c) => !c.role || c.role.toLowerCase() !== "family");
    }

    return patientContacts;
  }, [messageContacts, alert?.patient_name, userRole]);

  const normalizedType = (alert?.alert_type || "").toLowerCase();
  const normalizedSource = (alert?.source || "").toLowerCase();

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

  const phoneNumber = useMemo(
    () =>
      [alert?.patient_phone_country, alert?.patient_phone_number]
        .filter((part) => !!part)
        .join(""),
    [alert?.patient_phone_country, alert?.patient_phone_number],
  );

  const tone = useMemo(() => getAlertTone(alert), [alert]);
  const alertTypeLabel = useMemo(() => formatAlertType(alert?.alert_type), [alert?.alert_type]);

  const handleAcknowledge = async (how: string) => {
    setSavingHow(how);
    try {
      await onAcknowledge(how);

      if (how === "message") {
        if (relevantContacts.length === 1) {
          onOpenMessageWith?.(relevantContacts[0].id);
        }
        onOpenMessages();
      }

      setFollowupOpen(false);
      setMessageSubmenuOpen(false);
    } finally {
      setSavingHow(null);
    }
  };

  const handleOpenMessageSelector = () => {
    if (relevantContacts.length > 1) {
      setMessageSubmenuOpen(true);
      return;
    }

    if (relevantContacts.length === 1) {
      handleMessageContact(relevantContacts[0].id);
      return;
    }

    handleAcknowledge("message");
  };

  const handleMessageContact = async (contactId: string) => {
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

  if (!alert) return null;

  return (
    <>
      <div className="relative overflow-hidden rounded-[30px] border border-red-300/40 bg-gradient-to-br from-red-50/25 to-rose-50/20 p-[1.5px] shadow-[0_20px_55px_-22px_rgba(220,38,38,0.38)] dark:border-red-700/35 dark:from-red-950/20 dark:to-rose-950/15">
        <div className={`absolute inset-0 bg-gradient-to-br ${tone.shell}`} />
        <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl ${tone.glow}`} />
        <div className={`absolute bottom-0 left-6 h-24 w-24 rounded-full blur-2xl ${tone.glow}`} />

        <div className={`relative rounded-[28px] ${tone.panel} border border-white/50 dark:border-white/5 backdrop-blur-xl`}>
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 ${tone.icon}`}
              >
                <Siren className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={tone.badge}
                    className="rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase shadow-sm"
                  >
                    {alertTypeLabel}
                  </Badge>

                  {alert.priority ? (
                    <Badge variant="outline" className="rounded-full border-border/70 bg-background/85 px-3 py-1 text-[10px] capitalize shadow-sm">
                      {alert.priority}
                    </Badge>
                  ) : null}

                  {alert.source ? (
                    <Badge variant="outline" className="rounded-full border-border/70 bg-background/85 px-3 py-1 text-[10px] capitalize shadow-sm">
                      {alert.source}
                    </Badge>
                  ) : null}

                  {alert.is_acknowledged ? (
                    <Badge className="rounded-full border border-green-300 bg-green-100 px-3 py-1 text-[10px] text-green-800 shadow-sm dark:border-green-800 dark:bg-green-950/60 dark:text-green-300">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Acknowledged via {alert.acknowledged_via || "manual"}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="break-words text-sm font-semibold text-foreground sm:text-[15px]">
                      {alert.patient_name ? `${alert.patient_name}: ` : ""}
                      {alert.title}
                    </p>

                    {alert.voice_transcription ? (
                      <div className="rounded-2xl border border-border/70 bg-background/85 px-3 py-2 text-xs italic text-muted-foreground shadow-sm">
                        Transcription: {alert.voice_transcription}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>{formatTime(alert.created_at)}</span>
                      </div>

                      {alert.status ? (
                        <div className="rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-[11px] capitalize text-muted-foreground shadow-sm">
                          Status: {alert.status}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto lg:justify-end">
                    <Button
                      size="sm"
                      onClick={() => setFollowupOpen(true)}
                      disabled={!!alert.is_acknowledged}
                      className="h-10 flex-1 rounded-2xl px-4 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.35)] sm:flex-none"
                    >
                      Acknowledge & Follow-up
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="h-10 w-10 rounded-2xl border border-border/70 bg-background/85 text-muted-foreground shadow-sm transition-colors hover:bg-background"
                      title="Close banner"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={followupOpen} onOpenChange={setFollowupOpen}>
        <DialogContent className="overflow-hidden rounded-[30px] border border-border/80 bg-background/20 p-0 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:max-w-[560px]">
          <div className={`relative border-b border-border/70 bg-gradient-to-br ${tone.shell} px-6 py-5`}>
            <div className={`absolute right-0 top-0 h-32 w-32 rounded-full blur-3xl ${tone.glow}`} />
            <DialogHeader className="relative">
              <DialogTitle className="text-lg">{followUpMode.title}</DialogTitle>
              <DialogDescription className="pt-1 text-sm">
                {followUpMode.description}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-3 px-6 py-5">
            <Button
              variant="outline"
              className="h-12 w-full justify-start rounded-2xl border-border/70 bg-background shadow-md"
              disabled={!phoneNumber || !!savingHow}
              onClick={handleCallAndAcknowledge}
            >
              <Phone className="mr-2 h-4 w-4" />
              Call patient {phoneNumber ? `(${phoneNumber})` : "(no phone available)"}
            </Button>

            <Button
              variant="outline"
              className="h-12 w-full justify-between rounded-2xl border-border/70 bg-background shadow-md"
              disabled={!!savingHow}
              onClick={handleOpenMessageSelector}
            >
              <span className="flex items-center">
                <MessageSquare className="mr-2 h-4 w-4" />
                {relevantContacts.length === 1
                  ? `Message ${relevantContacts[0].name} and acknowledge`
                  : "Message care team and acknowledge"}
              </span>
              {relevantContacts.length > 1 ? <ChevronRight className="h-4 w-4" /> : null}
            </Button>

            <Button
              className="h-12 w-full justify-start rounded-2xl shadow-[0_10px_24px_-12px_rgba(0,0,0,0.35)]"
              disabled={!!savingHow}
              onClick={() => handleAcknowledge("manual_followup")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark as acknowledged and Manually Follow
            </Button>
          </div>

          <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4">
            <Button
              variant="ghost"
              onClick={() => setFollowupOpen(false)}
              disabled={!!savingHow}
              className="rounded-2xl"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={messageSubmenuOpen} onOpenChange={setMessageSubmenuOpen}>
        <DialogContent className="overflow-hidden rounded-[30px] border border-border/80 bg-background/98 p-0 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:max-w-[500px]">
          <div className={`relative border-b border-border/70 bg-gradient-to-br ${tone.shell} px-6 py-5`}>
            <div className={`absolute right-0 top-0 h-32 w-32 rounded-full blur-3xl ${tone.glow}`} />
            <DialogHeader className="relative">
              <DialogTitle className="text-lg">Select Contact</DialogTitle>
              <DialogDescription className="pt-1 text-sm">
                Choose who you want to message for this alert.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-3 px-6 py-5">
            {relevantContacts.map((contact) => (
              <Button
                key={contact.id}
                variant="outline"
                className="h-auto w-full justify-start rounded-2xl border-border/70 bg-background px-4 py-3 shadow-md"
                disabled={!!savingHow}
                onClick={() => handleMessageContact(contact.id)}
              >
                <div className="text-left">
                  <div className="text-sm font-semibold">{contact.name}</div>
                  {contact.role ? (
                    <div className="text-xs capitalize text-muted-foreground">{contact.role}</div>
                  ) : null}
                </div>
              </Button>
            ))}
          </div>

          <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4">
            <Button
              variant="ghost"
              onClick={() => setMessageSubmenuOpen(false)}
              disabled={!!savingHow}
              className="rounded-2xl"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};