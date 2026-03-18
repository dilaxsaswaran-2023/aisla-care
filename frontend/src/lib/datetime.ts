type DateInput = string | number | Date | null | undefined;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIMEZONE_PATTERN = /(?:[zZ]|[+\-]\d{2}:\d{2})$/;

function normalizeTimestamp(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return `${trimmed}T00:00:00Z`;
  }

  if (trimmed.includes("T") && !HAS_TIMEZONE_PATTERN.test(trimmed)) {
    return `${trimmed}Z`;
  }

  return trimmed;
}

export function parseDateTime(value: DateInput): Date | null {
  if (value === null || value === undefined) return null;

  const parsed =
    value instanceof Date
      ? value
      : typeof value === "string"
      ? new Date(normalizeTimestamp(value))
      : new Date(value);

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDateTime(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parseDateTime(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(date);
}

export function formatDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = parseDateTime(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...options,
  }).format(date);
}

export function formatTime(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = parseDateTime(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(date);
}

export function formatRelativeTime(value: DateInput): string {
  const date = parseDateTime(value);
  if (!date) return "-";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

export function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
