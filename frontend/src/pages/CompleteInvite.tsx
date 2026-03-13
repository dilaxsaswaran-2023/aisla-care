import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CountryCodePicker } from '@/components/ui/CountryCodePicker';
import { useToast } from '@/hooks/use-toast';

const CompleteInvite = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneCountry, setPhoneCountry] = useState(user?.phone_country || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [address, setAddress] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phoneNumber?: string }>({});

  const validateForm = () => {
    const newErrors: { fullName?: string; phoneNumber?: string } = {};
    
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const payload: any = {
        new_password: newPassword,
        full_name: fullName,
        phone_country: phoneCountry,
        phone_number: phoneNumber,
        address,
      };
      const res = await api.post('/auth/complete-invite', payload) as any;
      // store new tokens + user
      localStorage.setItem('aisla_access_token', res.accessToken);
      localStorage.setItem('aisla_refresh_token', res.refreshToken);
      localStorage.setItem('aisla_user', JSON.stringify(res.user));
      localStorage.setItem('aisla_role', res.user.role);
      toast({ title: 'Profile completed', description: 'Your account is now active.' });
      // Redirect based on role
      switch (res.user.role) {
        case 'super_admin': navigate('/super-admin'); break;
        case 'admin': navigate('/admin'); break;
        case 'caregiver': navigate('/caregiver'); break;
        case 'patient': navigate('/patient'); break;
        case 'family': navigate('/family'); break;
        default: navigate('/');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Complete your account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Full Name <span className="text-red-500">*</span></Label>
            <Input 
              value={fullName} 
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName && e.target.value.trim()) {
                  setErrors(prev => ({ ...prev, fullName: undefined }));
                }
              }}
              className={errors.fullName ? 'border-red-500' : ''}
            />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Password</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setShowPasswordField(!showPasswordField)}
                className="text-xs h-auto p-0"
              >
                {showPasswordField ? 'Cancel' : 'Change Password'}
              </Button>
            </div>
            {showPasswordField && (
              <Input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            )}
          </div>

          <div className="flex gap-2">
            <div className="w-40">
              <CountryCodePicker
                value={phoneCountry || '44'}
                onChange={setPhoneCountry}
                label="Country Code"
                placeholder="Search countries..."
              />
            </div>
            <div className="flex-1">
              <Label>Phone Number <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="Phone number" 
                value={phoneNumber} 
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (errors.phoneNumber && e.target.value.trim()) {
                    setErrors(prev => ({ ...prev, phoneNumber: undefined }));
                  }
                }}
                className={errors.phoneNumber ? 'border-red-500' : ''}
              />
              {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>}
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <Button type="submit" className="w-full">Save and Continue</Button>
        </form>
      </div>
    </div>
  );
};

export default CompleteInvite;
