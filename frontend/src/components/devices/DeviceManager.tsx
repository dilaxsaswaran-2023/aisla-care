import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Camera, Activity, DoorOpen, Watch, Power, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Device {
  id: string;
  device_type: string;
  name: string;
  location: string;
  is_active: boolean;
  last_reading_at: string | null;
}

interface DeviceManagerProps {
  patientId?: string;
}

const DeviceManager = ({ patientId }: DeviceManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    device_type: 'pir_sensor',
    location: '',
    stream_url: ''
  });

  useEffect(() => {
    loadDevices();
  }, [patientId]);

  const loadDevices = async () => {
    const targetId = patientId || user?.id;
    if (!targetId) return;

    try {
      const data = await api.get(`/devices?patientId=${targetId}`);

      // Add sample data if no devices exist
      if (!data || data.length === 0) {
        const sampleDevices = [
          {
            id: 'sample-1',
            device_type: 'camera',
            name: 'Living Room Camera',
            location: 'Living Room',
            is_active: true,
            last_reading_at: new Date().toISOString(),
          },
          {
            id: 'sample-2',
            device_type: 'door_sensor',
            name: 'Front Door Sensor',
            location: 'Main Entrance',
            is_active: true,
            last_reading_at: new Date(Date.now() - 300000).toISOString(),
          },
          {
            id: 'sample-3',
            device_type: 'wearable',
            name: 'Apple Watch',
            location: 'On Person',
            is_active: true,
            last_reading_at: new Date(Date.now() - 120000).toISOString(),
          },
          {
            id: 'sample-4',
            device_type: 'smart_plug',
            name: 'Kitchen Smart Plug',
            location: 'Kitchen',
            is_active: false,
            last_reading_at: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            id: 'sample-5',
            device_type: 'pir_sensor',
            name: 'Bedroom Motion Sensor',
            location: 'Bedroom',
            is_active: true,
            last_reading_at: new Date(Date.now() - 60000).toISOString(),
          }
        ];
        setDevices(sampleDevices as any);
      } else {
        setDevices(data);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const addDevice = async () => {
    const targetId = patientId || user?.id;
    if (!targetId) return;

    try {
      await api.post('/devices', {
        patient_id: targetId,
        device_type: formData.device_type,
        name: formData.name,
        location: formData.location,
        stream_url: formData.stream_url || null
      });
      toast({ title: 'Success', description: 'Device added successfully' });
      setOpen(false);
      setFormData({ name: '', device_type: 'pir_sensor', location: '', stream_url: '' });
      loadDevices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add device',
        variant: 'destructive'
      });
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'camera': return <Camera className="w-5 h-5" />;
      case 'pir_sensor': return <Activity className="w-5 h-5" />;
      case 'door_sensor': return <DoorOpen className="w-5 h-5" />;
      case 'wearable': return <Watch className="w-5 h-5" />;
      default: return <Power className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Connected Devices</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Device Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Living Room Camera"
                />
              </div>
              <div>
                <Label>Device Type</Label>
                <Select
                  value={formData.device_type}
                  onValueChange={(value) => setFormData({ ...formData, device_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="camera">Camera</SelectItem>
                    <SelectItem value="pir_sensor">Motion Sensor</SelectItem>
                    <SelectItem value="door_sensor">Door Sensor</SelectItem>
                    <SelectItem value="wearable">Wearable (Apple Watch)</SelectItem>
                    <SelectItem value="smart_plug">Smart Plug (Alexa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Living Room"
                />
              </div>
              {formData.device_type === 'camera' && (
                <div>
                  <Label>Stream URL (Optional)</Label>
                  <Input
                    value={formData.stream_url}
                    onChange={(e) => setFormData({ ...formData, stream_url: e.target.value })}
                    placeholder="rtsp://..."
                  />
                </div>
              )}
              <Button onClick={addDevice} className="w-full">
                Add Device
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((device) => (
          <Card key={device.id} className="care-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  device.is_active ? 'bg-success/10 text-success' : 'bg-muted'
                }`}>
                  {getDeviceIcon(device.device_type)}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{device.name}</div>
                  <div className="text-xs text-muted-foreground">{device.location}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${device.is_active ? 'bg-success' : 'bg-muted'}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {device.last_reading_at 
                  ? `Last active: ${new Date(device.last_reading_at).toLocaleString()}`
                  : 'No activity yet'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DeviceManager;
