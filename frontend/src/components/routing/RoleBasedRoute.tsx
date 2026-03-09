import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const RoleBasedRedirect = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    switch (userRole) {
      case 'super_admin':
        navigate('/super-admin');
        break;
      case 'admin':
        navigate('/admin');
        break;
      case 'caregiver':
        navigate('/caregiver');
        break;
      case 'patient':
        navigate('/patient');
        break;
      case 'family':
        navigate('/family');
        break;
      default:
        navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  return <div className="min-h-screen flex items-center justify-center">Redirecting...</div>;
};