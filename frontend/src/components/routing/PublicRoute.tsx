import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PublicRouteProps {
  element: React.ReactNode;
}

/**
 * PublicRoute component for auth-only pages (/auth)
 * - If still loading → show nothing (wait for auth to restore)
 * - If logged in → redirect to / (RoleBasedRedirect)
 * - If not logged in → render Auth page
 */
export const PublicRoute = ({ element }: PublicRouteProps) => {
  const { user, loading } = useAuth();

  // Still loading auth context
  if (loading) {
    return null;
  }

  // User is already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  // Not logged in, show auth page
  return element;
};
