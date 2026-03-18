export interface AuditLog {
  id: string;
  user_id: string | null;
  patient_id: string | null;
  caregiver_id: string | null;
  action: string;
  event_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  source: string | null;
  summary?: string | null;
  details?: string | null;
  severity?: string | null;
  outcome?: string | null;
  context?: Record<string, string> | null;
  changed_fields?: string[] | null;
  change_count?: number | null;
  changes?: Record<string, { old: string | null; new: string | null }> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
}

export interface AuditMetadata {
  summary?: string;
  details?: string;
  severity?: string;
  outcome?: string;
  changed_fields?: string[];
  changes?: Record<string, { old: string | null; new: string | null }>;
  change_count?: number;
  context?: Record<string, string>;
}

export type DatePreset =
  | "last_1h"
  | "last_3h"
  | "last_6h"
  | "last_12h"
  | "today"
  | "last_3_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

export interface UserItem {
  id: string;
  full_name?: string;
  email?: string;
}

export interface LogFilters {
  q: string;
  eventType: string;
  source: string;
  datePreset: DatePreset;
}

export type AuditBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const PAGE_SIZE = 50;

export const initialFilters: LogFilters = {
  q: "",
  eventType: "all",
  source: "all",
  datePreset: "today",
};

export const datePresetOptions: { value: DatePreset; label: string }[] = [
  { value: "last_1h", label: "Last 1 Hour" },
  { value: "last_3h", label: "Last 3 Hours" },
  { value: "last_6h", label: "Last 6 Hours" },
  { value: "last_12h", label: "Last 12 Hours" },
  { value: "today", label: "Today" },
  { value: "last_3_days", label: "Last 3 Days" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
];

export const getDateRange = (preset: DatePreset): { from: Date; to: Date } => {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  switch (preset) {
    case "last_1h":
      from.setHours(from.getHours() - 1);
      break;
    case "last_3h":
      from.setHours(from.getHours() - 3);
      break;
    case "last_6h":
      from.setHours(from.getHours() - 6);
      break;
    case "last_12h":
      from.setHours(from.getHours() - 12);
      break;
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "last_3_days":
      from.setDate(from.getDate() - 3);
      break;
    case "this_week": {
      const day = from.getDay();
      const diff = day === 0 ? 6 : day - 1;
      from.setDate(from.getDate() - diff);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case "last_week": {
      const day = from.getDay();
      const diff = day === 0 ? 6 : day - 1;
      from.setDate(from.getDate() - diff - 7);
      from.setHours(0, 0, 0, 0);
      const end = new Date(from);
      end.setDate(end.getDate() + 7);
      return { from, to: end };
    }
    case "this_month":
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case "last_month": {
      from.setMonth(from.getMonth() - 1, 1);
      from.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: end };
    }
  }

  return { from, to };
};

export const formatAction = (action: string) =>
  action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getActionVariant = (action: string): AuditBadgeVariant => {
  const value = action.toLowerCase();
  if (value.includes("sos") || value.includes("alert")) return "destructive";
  if (value.includes("created") || value.includes("granted")) return "default";
  return "secondary";
};

export const getSeverityVariant = (severity?: string | null): AuditBadgeVariant => {
  if (severity === "critical" || severity === "high") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
};

export const getMetadataView = (log: AuditLog) => {
  const meta = (log.metadata || {}) as AuditMetadata;
  const summary = log.summary || meta.summary;
  const details = log.details || meta.details;
  const severity = log.severity || meta.severity;
  const outcome = log.outcome || meta.outcome;
  const changedFields =
    (Array.isArray(log.changed_fields) ? log.changed_fields : null) ||
    (Array.isArray(meta.changed_fields) ? meta.changed_fields : []);
  const changes = log.changes ? Object.entries(log.changes) : Object.entries(meta.changes || {});
  const context = Object.entries(log.context || meta.context || {}).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== "",
  );

  return {
    summary,
    details,
    severity,
    outcome,
    changedFields,
    changes,
    context,
    isEmpty:
      !summary &&
      !details &&
      !severity &&
      !outcome &&
      changedFields.length === 0 &&
      changes.length === 0 &&
      context.length === 0,
  };
};

export const getVisualTone = (action: string, severity?: string | null) => {
  const value = action.toLowerCase();

  if (severity === "critical" || severity === "high" || value.includes("alert") || value.includes("sos")) {
    return {
      node:
        "border-red-200 bg-red-50 text-red-600 shadow-[0_10px_30px_-12px_rgba(239,68,68,0.45)] dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400",
      card:
        "from-red-500/12 via-rose-500/6 to-background dark:from-red-500/10 dark:via-rose-500/5 dark:to-background",
      connector: "via-red-400/80",
      ring: "ring-red-500/20",
    };
  }

  if (value.includes("created") || value.includes("granted")) {
    return {
      node:
        "border-emerald-200 bg-emerald-50 text-emerald-600 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.45)] dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400",
      card:
        "from-emerald-500/12 via-teal-500/6 to-background dark:from-emerald-500/10 dark:via-teal-500/5 dark:to-background",
      connector: "via-emerald-400/80",
      ring: "ring-emerald-500/20",
    };
  }

  if (value.includes("login") || value.includes("user")) {
    return {
      node:
        "border-sky-200 bg-sky-50 text-sky-600 shadow-[0_10px_30px_-12px_rgba(14,165,233,0.45)] dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-400",
      card:
        "from-sky-500/12 via-indigo-500/6 to-background dark:from-sky-500/10 dark:via-indigo-500/5 dark:to-background",
      connector: "via-sky-400/80",
      ring: "ring-sky-500/20",
    };
  }

  return {
    node:
      "border-violet-200 bg-violet-50 text-violet-600 shadow-[0_10px_30px_-12px_rgba(139,92,246,0.45)] dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-400",
    card:
      "from-violet-500/12 via-fuchsia-500/6 to-background dark:from-violet-500/10 dark:via-fuchsia-500/5 dark:to-background",
    connector: "via-violet-400/80",
    ring: "ring-violet-500/20",
  };
};