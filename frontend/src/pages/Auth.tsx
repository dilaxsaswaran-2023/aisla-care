import { useState } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Heart, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("patient");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLogin) {
      const { error, role } = await signIn(email, password);
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Welcome back!", description: "You've been successfully logged in." });
        // Check if user is invited and needs to complete their profile
        const raw = localStorage.getItem('aisla_user');
        try {
          const u = raw ? JSON.parse(raw) : null;
          if (u && (u as any).status === 'invited') {
            navigate('/complete-invite');
            return;
          }
        } catch {}

        switch (role) {
          case 'super_admin': navigate('/super-admin'); break;
          case 'admin': navigate('/admin'); break;
          case 'caregiver': navigate('/caregiver'); break;
          case 'patient': navigate('/patient'); break;
          case 'family': navigate('/family'); break;
          default: navigate('/');
        }
      }
    } else {
      const { error } = await signUp(email, password, name, role);
      if (error) {
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Account created!", description: "You can now log in with your credentials." });
        setIsLogin(true);
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary relative flex-col justify-between p-10 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, hsl(199 75% 52% / 0.5) 0%, transparent 60%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
              <Heart className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">AISLA</span>
          </div>
        </div>
        <div className="relative z-10 space-y-5">
          <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
            Intelligent care<br />for those who<br />matter most
          </h2>
          <p className="text-sm text-white/70 max-w-sm leading-relaxed">
            Real-time monitoring, AI-powered assistance, and seamless communication — all in one secure platform.
          </p>
          <div className="flex gap-6 pt-2 text-xs text-white/50">
            <span>🔒 End-to-end encrypted</span>
            <span>🏥 GDPR compliant</span>
          </div>
        </div>
        <p className="relative z-10 text-xs text-white/30">© {new Date().getFullYear()} AISLA Care Platform</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">AISLA</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Sign in to access your care dashboard" : "Get started with AISLA Care"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-medium">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="role" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patient">Patient</SelectItem>
                      <SelectItem value="caregiver">Caregiver</SelectItem>
                      <SelectItem value="family">Family Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 font-semibold gap-2">
              {isLogin ? "Sign In" : "Create Account"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary font-medium transition-colors"
            >
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <span className="text-primary">{isLogin ? "Sign up" : "Sign in"}</span>
            </button>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Auth;
