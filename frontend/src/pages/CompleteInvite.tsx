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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
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
              <Label>Phone Number</Label>
              <Input placeholder="Phone number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
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
