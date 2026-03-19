export type AlertTabKey = "overall" | "sos" | "geofence" | "medication" | "inactivity";

export interface AlertLike {
  id: string;
  alert_type: string;
  status: string;
  priority: string;
  title: string;
  message: string;
  voice_transcription?: string;
  patient_name?: string;
  created_at: string;
  source?: string;
  is_read?: boolean;
  is_acknowledged?: boolean;
  acknowledged_via?: string | null;
  patient_phone_country?: string | null;
  patient_phone_number?: string | null;
}

export interface AlertVisualStyle {
  container: string;
  iconWrap: string;
  icon: string;
  badge: string;
  accentDot: string;
}

export const ALERT_TABS: Array<{ key: AlertTabKey; label: string; icon: string }> = [
  { key: "overall", label: "Overall", icon: "Activity" },
  { key: "sos", label: "SOS", icon: "AlertTriangle" },
  { key: "geofence", label: "Geofence", icon: "MapPin" },
  { key: "medication", label: "Medication", icon: "Pill" },
  { key: "inactivity", label: "Inactivity", icon: "Clock" },
];

function normalizeType(value: string | undefined): string {
  return (value || "").toLowerCase();
}

export function getAlertCategory(alert: AlertLike): Exclude<AlertTabKey, "overall"> {
  const source = normalizeType(alert.source);
  const type = normalizeType(alert.alert_type);

  if (source === "geofence" || type.includes("geofence")) return "geofence";
  if (source === "medication" || type.includes("medication")) return "medication";
  if (source === "inactivity" || type.includes("inactivity")) return "inactivity";
  return "sos";
}

export function isEmergencyAlert(alert: AlertLike): boolean {
  return normalizeType(alert.source) === "budii";
}

export function matchesAlertTab(alert: AlertLike, tab: AlertTabKey): boolean {
  if (tab === "overall") return true;
  return getAlertCategory(alert) === tab;
}

export function getAlertVisualStyle(alert: AlertLike): AlertVisualStyle {
  if (isEmergencyAlert(alert)) {
    return {
      container: "border-destructive/70 bg-destructive/[0.08]",
      iconWrap: "bg-destructive/15",
      icon: "text-destructive",
      badge: "bg-destructive text-destructive-foreground",
      accentDot: "bg-destructive",
    };
  }

  const category = getAlertCategory(alert);

  if (category === "sos") {
    return {
      container: "border-orange-500/60 bg-orange-500/[0.08]",
      iconWrap: "bg-orange-500/20",
      icon: "text-orange-600",
      badge: "bg-orange-500/20 text-orange-700 border border-orange-500/30",
      accentDot: "bg-orange-500",
    };
  }

  if (category === "geofence") {
    return {
      container: "border-cyan-500/60 bg-cyan-500/[0.08]",
      iconWrap: "bg-cyan-500/20",
      icon: "text-cyan-700",
      badge: "bg-cyan-500/20 text-cyan-700 border border-cyan-500/30",
      accentDot: "bg-cyan-500",
    };
  }

  if (category === "medication") {
    return {
      container: "border-indigo-500/60 bg-indigo-500/[0.08]",
      iconWrap: "bg-indigo-500/20",
      icon: "text-indigo-700",
      badge: "bg-indigo-500/20 text-indigo-700 border border-indigo-500/30",
      accentDot: "bg-indigo-500",
    };
  }

  return {
    container: "border-emerald-500/60 bg-emerald-500/[0.08]",
    iconWrap: "bg-emerald-500/20",
    icon: "text-emerald-700",
    badge: "bg-emerald-500/20 text-emerald-700 border border-emerald-500/30",
    accentDot: "bg-emerald-500",
  };
}
