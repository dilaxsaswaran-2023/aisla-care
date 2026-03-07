import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, Check, X } from 'lucide-react';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    caregiverId: string;
    familyIds: string[];
  };
  setFormData: (data: any) => void;
  caregivers: any[];
  families: any[];
  caregiverSearch: string;
  setCaregiverSearch: (search: string) => void;
  familySearch: string;
  setFamilySearch: (search: string) => void;
  showCaregiverDropdown: boolean;
  setShowCaregiverDropdown: (show: boolean) => void;
  showFamilyDropdown: boolean;
  setShowFamilyDropdown: (show: boolean) => void;
  handleRoleChange: (role: string) => void;
  onCreateUser: () => void;
}

export const CreateUserDialog = ({
  open,
  onOpenChange,
  formData,
  setFormData,
  caregivers,
  families,
  caregiverSearch,
  setCaregiverSearch,
  familySearch,
  setFamilySearch,
  showCaregiverDropdown,
  setShowCaregiverDropdown,
  showFamilyDropdown,
  setShowFamilyDropdown,
  handleRoleChange,
  onCreateUser,
}: CreateUserDialogProps) => {
  const toggleFamilyId = (id: string) => {
    const ids = formData.familyIds.includes(id)
      ? formData.familyIds.filter((i) => i !== id)
      : [...formData.familyIds, id];
    setFormData({ ...formData, familyIds: ids });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Role Selection at Top */}
          <div>
            <Label>Role*</Label>
            <Select value={formData.role} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="caregiver">Caregiver</SelectItem>
                <SelectItem value="patient">Patient</SelectItem>
                <SelectItem value="family">Family</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Caregiver Selection - For Patient Role */}
          {formData.role === 'patient' && (
            <div>
              <Label>Caregiver (Optional)</Label>
              <div className="relative">
                <div
                  className="border rounded-lg p-2.5 cursor-pointer flex items-center justify-between bg-white"
                  onClick={() => setShowCaregiverDropdown(!showCaregiverDropdown)}
                >
                  <span className="text-sm">
                    {formData.caregiverId
                      ? caregivers.find((c) => c._id === formData.caregiverId)?.full_name || 'Select a caregiver'
                      : 'Select a caregiver'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
                {showCaregiverDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
                    <Input
                      placeholder="Search caregivers..."
                      value={caregiverSearch}
                      onChange={(e) => setCaregiverSearch(e.target.value)}
                      className="border-0 border-b rounded-none"
                    />
                    <div className="max-h-40 overflow-y-auto">
                      {caregivers.length > 0 ? (
                        caregivers.map((caregiver) => (
                          <div
                            key={caregiver._id}
                            className="p-2.5 hover:bg-muted/50 cursor-pointer text-sm"
                            onClick={() => {
                              setFormData({ ...formData, caregiverId: caregiver._id });
                              setShowCaregiverDropdown(false);
                              setCaregiverSearch('');
                            }}
                          >
                            <div className="font-medium">{caregiver.full_name}</div>
                            <div className="text-xs text-muted-foreground">{caregiver.email}</div>
                          </div>
                        ))
                      ) : (
                        <div className="p-2.5 text-sm text-muted-foreground">No caregivers found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Family Multi-Select - For Patient Role */}
          {formData.role === 'patient' && (
            <div>
              <Label>Family Members (Optional)</Label>

              {/* Selected chips */}
              {formData.familyIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2 mt-1">
                  {formData.familyIds.map((id) => {
                    const member = families.find((f) => f._id === id);
                    return member ? (
                      <div
                        key={id}
                        className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
                      >
                        <span>{member.full_name}</span>
                        <button
                          onClick={() => toggleFamilyId(id)}
                          className="hover:text-destructive ml-0.5"
                          aria-label={`Remove ${member.full_name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}

              <div className="relative">
                <div
                  className="border rounded-lg p-2.5 cursor-pointer flex items-center justify-between bg-white"
                  onClick={() => setShowFamilyDropdown(!showFamilyDropdown)}
                >
                  <span className="text-sm text-muted-foreground">
                    {formData.familyIds.length > 0
                      ? `${formData.familyIds.length} member${formData.familyIds.length > 1 ? 's' : ''} selected`
                      : 'Add family members...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
                {showFamilyDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
                    <Input
                      placeholder="Search family members..."
                      value={familySearch}
                      onChange={(e) => setFamilySearch(e.target.value)}
                      className="border-0 border-b rounded-none"
                    />
                    <div className="max-h-40 overflow-y-auto">
                      {families.length > 0 ? (
                        families.map((family) => {
                          const selected = formData.familyIds.includes(family._id);
                          return (
                            <div
                              key={family._id}
                              className={`p-2.5 hover:bg-muted/50 cursor-pointer text-sm flex items-center justify-between ${selected ? 'bg-primary/5' : ''}`}
                              onClick={() => toggleFamilyId(family._id)}
                            >
                              <div>
                                <div className="font-medium">{family.full_name}</div>
                                <div className="text-xs text-muted-foreground">{family.email}</div>
                              </div>
                              {selected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-2.5 text-sm text-muted-foreground">No family members found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button onClick={onCreateUser} className="w-full">
            Create User
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
