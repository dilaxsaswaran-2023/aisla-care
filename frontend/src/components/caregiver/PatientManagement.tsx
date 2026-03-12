import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserPlus, MessageSquare, Phone, MapPin, Activity, ChevronDown, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GeofenceSettingsDialog from './GeofenceSettingsDialog';
import { useAuth } from '@/contexts/AuthContext';
import ChatInterface from '@/components/chat/ChatInterface';
import { Switch } from '@/components/ui/switch';

interface Patient {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  email: string;
  role: string;
  is_geofencing?: boolean;
  location_boundary?: { latitude: number; longitude: number };
  boundary_radius?: number;
}

interface DropdownUser {
  _id: string;
  full_name: string;
  email: string;
}

const samplePatients: Patient[] = [
  { id: 'sample-1', full_name: 'Margaret Smith', phone: '+44 7700 900123', address: '14 Elm Road, London', email: 'margaret@example.com', role: 'patient' },
  { id: 'sample-2', full_name: 'John Davies', phone: '+44 7700 900456', address: '22 Oak Lane, Manchester', email: 'john@example.com', role: 'patient' },
  { id: 'sample-3', full_name: 'Patricia Wilson', phone: '+44 7700 900789', address: '8 Pine Street, Bristol', email: 'patricia@example.com', role: 'patient' },
];

export const PatientManagement = ({ isMobile }: { isMobile?: boolean }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [geofenceDialogOpen, setGeofenceDialogOpen] = useState(false);
  const [geofencePatient, setGeofencePatient] = useState<Patient | null>(null);
  const [geofenceLoading, setGeofenceLoading] = useState(false);
  const [geofenceForm, setGeofenceForm] = useState({
    is_geofencing: false,
    latitude: 0,
    longitude: 0,
    radius: 10,
  });
  const [userPatients, setUserPatients] = useState<DropdownUser[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const [formData, setFormData] = useState({
    userType: 'patient', // 'patient' or 'family'
    email: '',
    password: '',
    fullName: '',
    phone: '',
    address: '',
    familyId: '',
  });

  useEffect(() => {
    loadPatients();
  }, [user]);

  const loadPatients = async () => {
    if (!user) return;
    try {
      const data = await api.get('/users') as any[];
      if (data && data.length > 0) {
        setPatients(data.map((p: any) => ({
          id: p._id || p.id,
          full_name: p.full_name,
          phone: p.phone || '',
          address: p.address || '',
          email: p.email || '',
          role: p.role,
          is_geofencing: p.is_geofencing || false,
          location_boundary: p.location_boundary || { latitude: 0, longitude: 0 },
          boundary_radius: p.boundary_radius || 10,
        })));
        return;
      }
    } catch {
      // fall through to sample
    }
    setPatients(samplePatients);
  };

  const loadUserFamilies = useCallback(async (search: string = '') => {
    try {
      const data = await api.get(`/users/family-list${search ? `?search=${search}` : ''}`) as DropdownUser[];
      setUserPatients(data || []);
    } catch (error) {
      console.error('Error loading families:', error);
      setUserPatients([]);
    }
  }, []);

  const handleUserTypeChange = (type: string) => {
    setFormData({
      userType: type,
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      phone: formData.phone,
      address: formData.address,
      familyId: '',
    });

    if (type === 'patient') {
      loadUserFamilies();
    }
  };

  const handlePatientSearchChange = (search: string) => {
    setPatientSearch(search);
    loadUserFamilies(search);
  };

  const selectPatient = (patient: DropdownUser) => {
    setFormData({ ...formData, familyId: patient._id });
    setShowPatientDropdown(false);
    setPatientSearch('');
  };

  const createUser = async () => {
    if (!formData.fullName || !formData.email || !formData.password) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      const payload: any = {
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName,
        role: formData.userType,
      };

      if (formData.userType === 'patient') {
        // Caregiver automatically added to patient
        payload.caregiver_id = user?.id;
        // Add phone and address if provided
        if (formData.phone) payload.phone = formData.phone;
        if (formData.address) payload.address = formData.address;
        // Add family_id if provided
        if (formData.familyId) payload.family_id = formData.familyId;
      }

      await api.post('/users', payload);
      toast({ title: 'Success', description: `${formData.userType === 'patient' ? 'Patient' : 'Family member'} added successfully` });
      setOpen(false);
      setFormData({
        userType: 'patient',
        email: '',
        password: '',
        fullName: '',
        phone: '',
        address: '',
        familyId: '',
      });
      setPatientSearch('');
      setShowPatientDropdown(false);
      loadPatients();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddClick = () => {
    setFormData({
      userType: 'patient',
      email: '',
      password: '',
      fullName: '',
      phone: '',
      address: '',
      familyId: '',
    });
    setPatientSearch('');
    setShowPatientDropdown(false);
    setOpen(true);
  };

  const handleSaveGeofence = async () => {
    if (!geofencePatient) return;

    setGeofenceLoading(true);
    try {
      await api.post('/geofence/setup', {
        patient_id: geofencePatient.id,
        is_geofencing: geofenceForm.is_geofencing,
        location_boundary: {
          latitude: geofenceForm.latitude,
          longitude: geofenceForm.longitude,
        },
        boundary_radius: geofenceForm.radius,
      });

      toast({
        title: 'Success',
        description: 'Geofence settings saved successfully',
      });

      setGeofenceDialogOpen(false);
      loadPatients();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save geofence settings',
        variant: 'destructive',
      });
    } finally {
      setGeofenceLoading(false);
    }
  };

  const isSample = patients === samplePatients;

  return (
    <>
      <Card className="care-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">My Patients</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" onClick={handleAddClick}>
                  <UserPlus className="w-4 h-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Patient or Family Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* User Type Selection */}
                  <div>
                    <Label>User Type*</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={formData.userType === 'patient' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => handleUserTypeChange('patient')}
                      >
                        Patient
                      </Button>
                      <Button
                        variant={formData.userType === 'family' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => handleUserTypeChange('family')}
                      >
                        Family
                      </Button>
                    </div>
                  </div>

                  {/* Basic Fields */}
                  <div>
                    <Label>Full Name*</Label>
                    <Input
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <Label>Email*</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <Label>Password*</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                    />
                  </div>

                  {/* Patient-specific fields */}
                  {formData.userType === 'patient' && (
                    <>
                      <div>
                        <Label>Phone (Optional)</Label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <Label>Address (Optional)</Label>
                        <Input
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="Enter address"
                        />
                      </div>

                      {/* Family Selection for Patient */}
                      <div>
                        <Label>Family Member (Optional)</Label>
                        <div className="relative">
                          <div
                            className="border rounded-lg p-2.5 cursor-pointer flex items-center justify-between bg-white"
                            onClick={() => {
                              setShowPatientDropdown(!showPatientDropdown);
                              if (!showPatientDropdown && userPatients.length === 0) {
                                loadUserFamilies();
                              }
                            }}
                          >
                            <span className="text-sm">
                              {formData.familyId
                                ? userPatients.find((p) => p._id === formData.familyId)?.full_name || 'Select a family member'
                                : 'Select a family member'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          </div>
                          {showPatientDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
                              <Input
                                placeholder="Search family members..."
                                value={patientSearch}
                                onChange={(e) => handlePatientSearchChange(e.target.value)}
                                className="border-0 border-b rounded-none"
                              />
                              <div className="max-h-40 overflow-y-auto">
                                {userPatients.length > 0 ? (
                                  userPatients.map((family) => (
                                    <div
                                      key={family._id}
                                      className="p-2.5 hover:bg-muted/50 cursor-pointer text-sm"
                                      onClick={() => selectPatient(family)}
                                    >
                                      <div className="font-medium">{family.full_name}</div>
                                      <div className="text-xs text-muted-foreground">{family.email}</div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2.5 text-sm text-muted-foreground">No family members found</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-800">
                          ℹ️ You will be automatically set as the caregiver for this patient.
                        </p>
                      </div>
                    </>
                  )}

                  <Button onClick={createUser} className="w-full">
                    Add {formData.userType === 'patient' ? 'Patient' : 'Family Member'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isSample && (
            <div className="bg-accent/50 border border-primary/10 rounded-lg p-3 mb-4">
              <p className="text-xs text-muted-foreground">Showing sample data — assign real patients to see live information.</p>
            </div>
          )}
          <div className="space-y-3">
            {patients.map((patient) => (
              <div key={patient.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {patient.full_name.split(' ').map((n) => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{patient.full_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {patient.phone || 'No phone'}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {patient.address || 'No address'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Activity className="w-3 h-3" />
                    Active
                  </Badge>
                  <Button
                    size="sm"
                    variant={isMobile ? "ghost" : "outline"}
                    className={`gap-1.5 h-8 ${isMobile ? "p-2" : ""}`}
                    title="Chat"
                    onClick={() => {
                      setSelectedPatient(patient);
                      setChatOpen(true);
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {!isMobile && <span className="text-xs">Chat</span>}
                  </Button>
                  <Button 
                    size="sm" 
                    variant={isMobile ? "ghost" : "outline"} 
                    className={`gap-1.5 h-8 ${isMobile ? "p-2" : ""}`}
                    title="Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {!isMobile && <span className="text-xs">Call</span>}
                  </Button>
                  <Button
                    size="sm"
                    variant={isMobile ? "ghost" : "outline"}
                    className={`gap-1.5 h-8 ${isMobile ? "p-2" : ""}`}
                    title="Settings"
                    onClick={() => {
                      setGeofencePatient(patient);
                      setGeofenceForm({
                        is_geofencing: patient.is_geofencing || false,
                        latitude: patient.location_boundary?.latitude || 0,
                        longitude: patient.location_boundary?.longitude || 0,
                        radius: patient.boundary_radius || 10,
                      });
                      setGeofenceDialogOpen(true);
                    }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {!isMobile && <span className="text-xs">Settings</span>}
                  </Button>
                  <Button
                    size="sm"
                    variant={isMobile ? "ghost" : "outline"}
                    className={`gap-1.5 h-8 ${isMobile ? "p-2" : ""}`}
                    title="Location"
                    onClick={() => {
                      navigate('?tab=map');
                    }}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {!isMobile && <span className="text-xs">Location</span>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-4xl h-[600px]">
          <DialogHeader>
            <DialogTitle>Chat with {selectedPatient?.full_name}</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <ChatInterface recipientId={selectedPatient.id} recipientName={selectedPatient.full_name} />
          )}
        </DialogContent>
      </Dialog>

      <GeofenceSettingsDialog
        open={geofenceDialogOpen}
        onOpenChange={setGeofenceDialogOpen}
        geofencePatient={geofencePatient}
        geofenceForm={geofenceForm}
        setGeofenceForm={setGeofenceForm}
        geofenceLoading={geofenceLoading}
        setGeofenceLoading={setGeofenceLoading}
        onSave={handleSaveGeofence}
        onClose={() => setGeofenceDialogOpen(false)}
      />
    </>
  );
};
