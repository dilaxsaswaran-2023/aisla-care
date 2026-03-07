import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, MessageSquare, Activity, Bell, User } from 'lucide-react';

interface Event {
  id: string;
  action: string;
  entity_type: string;
  metadata: any;
  created_at: string;
}

interface EventTimelineProps {
  patientId?: string;
}

const EventTimeline = ({ patientId }: EventTimelineProps) => {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    loadEvents();
  }, [patientId]);

  const loadEvents = async () => {
    try {
      const url = patientId ? `/audit-logs?userId=${patientId}` : '/audit-logs';
      const data = await api.get(url);
      setEvents(data || []);
    } catch (err) {
      console.error('Error loading events:', err);
    }
  };

  const getEventIcon = (action: string) => {
    if (action.includes('alert') || action.includes('sos')) return <AlertCircle className="w-4 h-4" />;
    if (action.includes('message') || action.includes('chat')) return <MessageSquare className="w-4 h-4" />;
    if (action.includes('budii')) return <Activity className="w-4 h-4" />;
    if (action.includes('reminder')) return <Bell className="w-4 h-4" />;
    return <User className="w-4 h-4" />;
  };

  const getEventColor = (action: string) => {
    if (action.includes('alert') || action.includes('sos')) return 'text-destructive';
    if (action.includes('budii')) return 'text-primary';
    return 'text-muted-foreground';
  };

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-4">
        {events.map((event) => (
          <div key={event.id} className="flex gap-3 items-start">
            <div className={`mt-1 ${getEventColor(event.action)}`}>
              {getEventIcon(event.action)}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm capitalize">
                  {event.action.replace(/_/g, ' ')}
                </span>
                {event.entity_type && (
                  <Badge variant="outline" className="text-xs">
                    {event.entity_type}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleString()}
              </div>
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                  {JSON.stringify(event.metadata, null, 2)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default EventTimeline;
