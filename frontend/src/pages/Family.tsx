import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin, Heart, Activity, MessageSquare, Phone, Video, Clock, Bell
} from "lucide-react";
import PortalLayout from "@/components/layout/PortalLayout";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { label: "Status", value: "status", icon: Activity },
  { label: "Location", value: "location", icon: MapPin },
  { label: "Messages", value: "messages", icon: MessageSquare },
];

const Family = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("status");
  const { toast } = useToast();

  // Sync active tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab') || 'status';
    setActiveTab(tabFromUrl);
  }, [location.search]);

  // Handle tab change and update URL
  const handleTabChange = (tab: string) => {
    navigate(`?tab=${tab}`, { replace: true });
  };

  const pageTitles: Record<string, { title: string; desc: string }> = {
    status: { title: "Patient Status", desc: "Margaret Smith — Your Mother" },
    location: { title: "Location", desc: "Real-time location monitoring" },
    messages: { title: "Messages", desc: "Updates from the care team" },
  };
  const current = pageTitles[activeTab] || pageTitles.status;

  return (
    <PortalLayout
      title="AISLA"
      subtitle="Family"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      pageTitle={current.title}
      pageDescription={current.desc}
      headerActions={
        <Button variant="outline" size="sm" className="gap-2" onClick={() => toast({ title: "Calling Caregiver", description: "Connecting you with Sarah Johnson..." })}>
          <Phone className="w-4 h-4" />Call Caregiver
        </Button>
      }
    >
      {activeTab === "status" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="care-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Status</span>
                <Heart className="w-4 h-4 text-success" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span className="stat-value text-success text-2xl">Safe & Well</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Last updated: 5 mins ago</p>
            </Card>
            <Card className="care-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</span>
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <p className="text-lg font-semibold text-foreground">Home</p>
              <p className="text-xs text-muted-foreground mt-1">Living Room · 2 mins ago</p>
            </Card>
          </div>

          <Card className="care-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Today's Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { text: "Morning medication taken", time: "8:15 AM", color: "bg-success" },
                { text: "Chatted with Budii assistant", time: "10:30 AM", color: "bg-primary" },
                { text: "Lunch reminder acknowledged", time: "12:45 PM", color: "bg-success" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className={`w-2 h-2 rounded-full ${item.color} mt-1.5`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.text}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />{item.time}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="care-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assigned Caregiver</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">SJ</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Sarah Johnson</p>
                    <p className="text-xs text-muted-foreground">Senior Care Specialist</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8"><Phone className="w-3.5 h-3.5" />Call</Button>
                  <Button size="sm" variant="outline" className="gap-1.5 h-8"><Video className="w-3.5 h-3.5" />Video</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "location" && (
        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Location</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative w-full h-[400px] bg-muted rounded-b-xl overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <MapPin className="w-12 h-12 text-primary mx-auto" />
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-1">Location Tracking Active</h3>
                    <p className="text-sm text-muted-foreground">Margaret is currently at home in the living room</p>
                  </div>
                  <Card className="care-card p-4 max-w-xs mx-auto">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-success" />
                      <span className="text-sm font-medium">Safe Zone — Home</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Last updated: 2 mins ago</p>
                  </Card>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "messages" && (
        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Caregiver Communications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-accent/50 p-4 rounded-lg border border-primary/10">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">SJ</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Sarah Johnson</p>
                  <p className="text-xs text-muted-foreground">Today at 2:30 PM</p>
                </div>
              </div>
              <p className="text-sm text-foreground leading-relaxed ml-11">
                Hi! Margaret had a great day today. She enjoyed her lunch and had a nice chat with Budii. All medications taken on time.
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">System Update</p>
                  <p className="text-xs text-muted-foreground">Today at 8:00 AM</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed ml-11">
                Morning routine completed successfully. All reminders acknowledged.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </PortalLayout>
  );
};

export default Family;
