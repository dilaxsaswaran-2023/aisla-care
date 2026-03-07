import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import { UserRow } from './types';

interface FormData {
  patient_id: string;
  related_user_id: string;
  relationship_type: 'caregiver' | 'family' | 'admin' | 'patient';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  patients: UserRow[];
  caregivers: UserRow[];
  familyMembers: UserRow[];
  formData: FormData;
  setFormData: (data: FormData) => void;
  onSubmit: () => void;
}

export const AddRelationshipDialog = ({
  open,
  onOpenChange,
  isMobile,
  patients,
  caregivers,
  familyMembers,
  formData,
  setFormData,
  onSubmit,
}: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {isMobile ? (
        <DialogTrigger asChild>
          <Button size="icon" title="Add Relationship">
            <UserPlus className="w-4 h-4" />
          </Button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Add Relationship
          </Button>
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Relationship</DialogTitle>
          <DialogDescription>
            Assign a caregiver or family member to a patient
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Patient</label>
            <Select
              value={formData.patient_id}
              onValueChange={(v) => setFormData({ ...formData, patient_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Relationship Type</label>
            <Select
              value={formData.relationship_type}
              onValueChange={(v) =>
                setFormData({ ...formData, relationship_type: v as any })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="caregiver">Caregiver</SelectItem>
                <SelectItem value="family">Family Member</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {formData.relationship_type === 'caregiver'
                ? 'Caregiver'
                : 'Family Member'}
            </label>
            <Select
              value={formData.related_user_id}
              onValueChange={(v) =>
                setFormData({ ...formData, related_user_id: v })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={`Select a ${formData.relationship_type}`}
                />
              </SelectTrigger>
              <SelectContent>
                {(formData.relationship_type === 'caregiver'
                  ? caregivers
                  : familyMembers
                ).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={onSubmit} className="w-full">
            Create Relationship
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
