import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  created_at: string;
  source?: string;
  is_read?: boolean;
  is_added_to_emergency?: boolean;
}

interface EmergencyBannerProps {
  alert: AlertItem | null;
  onClose: () => void;
}

export const EmergencyBanner = ({ alert, onClose }: EmergencyBannerProps) => {
  if (!alert) return null;

  // Determine alert type label
  const alertTypeLabel = alert.alert_type === 'sos' ? '🚨 SOS ALERT' : '⚠️ GEOFENCE BREACH';

  return (
    <div className="bg-red-50 border-b-2 border-red-500 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-red-900 text-sm mb-1">
              {alertTypeLabel}
            </div>
            <div className="text-red-800 font-semibold text-sm break-words">
              {alert.patient_name ? `${alert.patient_name}: ` : ''}{alert.title}
            </div>
            <div className="text-red-700 text-xs mt-1 break-words">
              {alert.message}
            </div>
            {alert.voice_transcription && (
              <div className="text-red-700 text-xs italic mt-1 break-words">
                📝 {alert.voice_transcription}
              </div>
            )}
            <div className="text-red-600 text-xs mt-1">
              {formatTime(alert.created_at)}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="flex-shrink-0 hover:bg-red-100 text-red-600"
          title="Close banner"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

