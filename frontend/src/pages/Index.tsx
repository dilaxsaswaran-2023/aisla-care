import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart, Users, UserCircle, Smartphone, Shield, ArrowRight, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const navigate = useNavigate();
  const { user, userRole, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user && userRole) {
      switch (userRole) {
        case 'super_admin': navigate('/super-admin'); break;
        case 'admin': navigate('/admin'); break;
        case 'caregiver': navigate('/dashboard'); break;
        case 'patient': navigate('/patient'); break;
        case 'family': navigate('/family'); break;
      }
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary">
            <Heart className="w-6 h-6 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const portals = [
    {
      title: "Admin",
      description: "System configuration, user management & audit logs",
      icon: Shield,
      route: "/admin",
      color: "bg-warning/10 text-warning",
      primary: false,
    },
    {
      title: "Caregiver",
      description: "Monitor patients, manage alerts, coordinate care plans",
      icon: Users,
      route: "/dashboard",
      color: "bg-primary/10 text-primary",
      primary: true,
    },
    {
      title: "Family",
      description: "View patient status, location & caregiver updates",
      icon: UserCircle,
      route: "/family",
      color: "bg-accent text-accent-foreground",
      primary: false,
    },
    {
      title: "Patient",
      description: "Access help, reminders, Budii AI assistant & SOS",
      icon: Smartphone,
      route: "/patient",
      color: "bg-success/10 text-success",
      primary: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary">
              <Heart className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground tracking-tight">AISLA</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="gap-2">
            <Lock className="w-3.5 h-3.5" />
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-4xl w-full gentle-fade-in">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-5 border border-primary/15">
              <Heart className="w-3.5 h-3.5" />
              Integrated Supporting Living Assistant
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4 leading-[1.1]">
              Compassionate care,<br />powered by technology
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Select your portal below to access real-time monitoring, communication, and AI-powered support.
            </p>
          </div>

          {/* Portal cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <button
                  key={portal.route}
                  onClick={() => navigate(portal.route)}
                  className="group care-card p-5 text-left hover:border-primary/30 transition-all duration-200"
                >
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 ${portal.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-foreground text-base mb-1.5 group-hover:text-primary transition-colors">
                    {portal.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {portal.description}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AISLA Care · Enterprise-grade security · GDPR compliant
        </p>
      </footer>
    </div>
  );
};

export default Index;
