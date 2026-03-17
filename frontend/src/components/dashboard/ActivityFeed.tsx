import { MessageSquare, MapPin, CheckCircle, Heart, Clock } from "lucide-react";

const ActivityFeed = () => {
  const activities: any[] = [];

  return (
    <div className="space-y-1">
      {activities.length === 0 ? (
        <div className="p-3 rounded-lg border border-border bg-card text-sm text-muted-foreground">No recent activity</div>
      ) : activities.map((activity, index) => {
        const Icon = activity.icon;
        return (
          <div key={activity.id} className="relative">
            {index !== activities.length - 1 && (
              <div className="absolute left-[19px] top-11 bottom-0 w-px bg-border" />
            )}
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.bgColor} ${activity.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 pb-3">
                <p className="font-medium text-sm text-foreground">{activity.patient}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{activity.message}</p>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{activity.time}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityFeed;
