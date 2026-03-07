import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleBasedRedirect } from "./components/routing/RoleBasedRoute";
import { ProtectedRoute } from "./components/routing/ProtectedRoute";
import { PublicRoute } from "./components/routing/PublicRoute";
import Auth from "./pages/Auth";
import Caregiver from "./pages/Caregiver";
import Family from "./pages/Family";
import Patient from "./pages/Patient";
import Admin from "./pages/Admin";
import SuperAdmin from "./pages/SuperAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Home routes to role-based pages */}
            <Route path="/" element={<RoleBasedRedirect />} />
            
            {/* Auth routes (only accessible when not logged in) */}
            <Route 
              path="/auth" 
              element={<PublicRoute element={<Auth />} />} 
            />
            
            {/* Role-based routes (protected by role) */}
            <Route 
              path="/caregiver" 
              element={<ProtectedRoute element={<Caregiver />} requiredRole="caregiver" />} 
            />
            <Route 
              path="/family" 
              element={<ProtectedRoute element={<Family />} requiredRole="family" />} 
            />
            <Route 
              path="/patient" 
              element={<ProtectedRoute element={<Patient />} requiredRole="patient" />} 
            />
            <Route 
              path="/admin" 
              element={<ProtectedRoute element={<Admin />} requiredRole="admin" />} 
            />
            <Route 
              path="/super-admin" 
              element={<ProtectedRoute element={<SuperAdmin />} requiredRole="super_admin" />} 
            />
            
            {/* Catch-all for undefined routes */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
