import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ChevronDown,
  Clock,
  Settings,
  User,
} from "lucide-react";
import {
  AuditLog,
  formatAction,
  getActionVariant,
  getMetadataView,
  getSeverityVariant,
  getVisualTone,
} from "./audit-log.utils";

const getActionIcon = (action: string) => {
  const value = action.toLowerCase();
  if (value.includes("alert") || value.includes("sos")) return <AlertCircle className="h-4 w-4" />;
  if (value.includes("user") || value.includes("login")) return <User className="h-4 w-4" />;
  return <Settings className="h-4 w-4" />;
};

const InfoLine = ({ label, value }: { label: string; value: string | null }) => {
  if (!value) return null;

  return (
    <div className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm">
      <span className="font-medium text-foreground/85">{label}:</span> {value}
    </div>
  );
};

const MetadataBlock = ({ log }: { log: AuditLog }) => {
  const { summary, details, severity, outcome, changedFields, changes, context, isEmpty } = getMetadataView(log);

  if (isEmpty) return null;

  return (
    <div className="mt-4 rounded-2xl border border-border/60 bg-background/70 p-3 shadow-inner backdrop-blur-sm">
      {(severity || outcome) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {severity && (
            <Badge variant={getSeverityVariant(severity)} className="rounded-full px-2.5 py-0.5 text-[10px] capitalize">
              {severity}
            </Badge>
          )}
          {outcome && (
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px]">
              {outcome}
            </Badge>
          )}
        </div>
      )}

      <div className="space-y-3">
        {summary && <p className="text-[12px] font-medium text-foreground/95">{summary}</p>}
        {details && <p className="text-[11px] leading-5 text-muted-foreground">{details}</p>}

        {context.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {context.slice(0, 6).map(([key, value]) => (
              <div
                key={key}
                className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-[10px] text-muted-foreground"
              >
                <span className="font-medium text-foreground/80">{key}:</span> {String(value)}
              </div>
            ))}
          </div>
        )}

        {changedFields.length > 0 && (
          <div className="rounded-xl bg-muted/50 px-2.5 py-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Changed:</span> {changedFields.join(", ")}
          </div>
        )}

        {changes.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {changes.slice(0, 6).map(([field, value]) => (
              <div key={field} className="rounded-xl border border-border/60 bg-muted/40 px-2.5 py-2 text-[11px]">
                <p className="mb-1 font-medium text-foreground/85">{field}</p>
                <p className="break-words text-muted-foreground">
                  {String(value?.old ?? "null")} <span className="mx-1">→</span> {String(value?.new ?? "null")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface TimelineCardProps {
  log: AuditLog;
  index: number;
  expanded: boolean;
  onToggle: (id: string) => void;
  getUserLabel: (id?: string | null) => string | null;
}

export const TimelineCard = ({
  log,
  index,
  expanded,
  onToggle,
  getUserLabel,
}: TimelineCardProps) => {
  const actor = getUserLabel(log.user_id);
  const patient = getUserLabel(log.patient_id);
  const caregiver = getUserLabel(log.caregiver_id);
  const meta = getMetadataView(log);
  const severity = meta.severity;
  const compactSummary = meta.summary || meta.details || "No additional summary available";
  const isLeft = index % 2 === 0;
  const tone = getVisualTone(log.action, severity);

  return (
    <div className="relative grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] md:items-start">
      <div
        className={`relative ${isLeft ? "md:col-start-1" : "md:col-start-3"} transition-all duration-300`}
      >
        <div
          className={`absolute top-10 hidden h-px w-10 bg-gradient-to-r from-transparent ${tone.connector} to-transparent md:block ${
            isLeft ? "-right-10" : "-left-10"
          }`}
        />

        <div
          className={`relative overflow-hidden rounded-[28px] border bg-gradient-to-br ${tone.card} p-[1px] shadow-[0_10px_40px_-18px_rgba(0,0,0,0.18)] transition-all duration-300 ${
            expanded ? `scale-[1.01] ${tone.ring} ring-1` : "hover:scale-[1.005]"
          }`}
        >
          <div className="rounded-[27px] bg-card/92 backdrop-blur-xl">
            <button type="button" onClick={() => onToggle(log.id)} className="w-full p-5 text-left">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border md:hidden ${tone.node}`}>
                  {getActionIcon(log.action)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={getActionVariant(log.action)} className="rounded-full px-3 py-1 text-[10px]">
                      {formatAction(log.action)}
                    </Badge>

                    {expanded && log.event_type && (
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px]">
                        {log.event_type}
                      </Badge>
                    )}

                    {expanded && log.source && (
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px]">
                        {log.source}
                      </Badge>
                    )}

                    {expanded && severity && (
                      <Badge variant={getSeverityVariant(severity)} className="rounded-full px-3 py-1 text-[10px] capitalize">
                        {severity}
                      </Badge>
                    )}
                  </div>

                  <p className={`text-foreground/90 transition-all duration-300 ${expanded ? "text-[13px] leading-6" : "line-clamp-2 text-[13px] leading-6"}`}>
                    {compactSummary}
                  </p>
                </div>

                <div className="flex shrink-0 flex-row items-end gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>

                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border border-border/50 bg-background/80 text-muted-foreground transition-all duration-300 ${
                      expanded ? "rotate-180 bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </button>

            <div
              className={`grid transition-all duration-300 ease-out ${
                expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="border-t border-border/60 px-5 pb-5 pt-4">
                  <div className="flex flex-wrap gap-1.5">
                    <InfoLine label="Done By" value={actor} />
                    <InfoLine label="Patient" value={patient} />
                    <InfoLine label="Caregiver" value={caregiver} />
                    <InfoLine label="IP" value={log.ip_address} />
                    <InfoLine label="Entity" value={log.entity_type} />
                    <InfoLine label="Entity ID" value={log.entity_id} />
                  </div>

                  <MetadataBlock log={log} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-7 hidden -translate-x-1/2 md:flex">
        <div
          className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300 ${
            expanded ? `scale-110 ${tone.ring}` : ""
          } ${tone.node}`}
        >
          <div className="absolute inset-0 rounded-2xl bg-white/10 blur-sm" />
          <div className="relative">{getActionIcon(log.action)}</div>
        </div>
      </div>
    </div>
  );
};