import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AuthOnlyRouteProps {
  element: React.ReactNode;
}

export const AuthOnlyRoute = ({ element }: AuthOnlyRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return element;
};

export default AuthOnlyRoute;
