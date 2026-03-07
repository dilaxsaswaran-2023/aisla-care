import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  element: React.ReactNode;
  requiredRole: string;
}

/**
 * ProtectedRoute component that validates user role before allowing access
 * - If still loading → show nothing (wait for auth to restore from localStorage)
 * - If not logged in → redirect to /auth
 * - If logged in but wrong role → redirect to / (RoleBasedRedirect)
 * - If correct role → render component
 */
export const ProtectedRoute = ({ element, requiredRole }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  // Still loading auth context (checking localStorage, validating session)
  if (loading) {
    return null;
  }

  // Not logged in after loading is complete
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Logged in but wrong role
  if (user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // Correct role
  return element;
};
