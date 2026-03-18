import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CountryCodePicker } from '@/components/ui/CountryCodePicker';
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
    caregiverIds: string[];
    familyIds: string[];
    phone_country?: string;
    phone_number?: string;
    caregiver_type?: string;
    caregiver_subtype?: string;
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
  const caregiverSubtypes: Record<string, string[]> = {
    'Home Care Assistants': ['Domiciliary Carer', 'Reablement Assistant'],
    'Medical/Clinical': ['District Nurse', 'Admiral Nurse', 'Stroke Nurse'],
    'Therapy/Physical': ['Occupational Therapist (OT)', 'Physiotherapist', 'Cognitive Stimulation Therapist'],
    'Communication': ['Social Worker', 'MH Social Worker', 'SLT'],
    'Day-to-Day/Social': ['Befriender', 'Companion', 'Respite', 'Support Worker'],
    'Nutrition': ['Meals on Wheels', 'Cook', 'Dietician'],
  };
  const toggleFamilyId = (id: string) => {
    const ids = formData.familyIds.includes(id)
      ? formData.familyIds.filter((i) => i !== id)
      : [...formData.familyIds, id];
    setFormData({ ...formData, familyIds: ids });
  };

  const toggleCaregiverId = (id: string) => {
    const ids = formData.caregiverIds.includes(id)
      ? formData.caregiverIds.filter((i) => i !== id)
      : [...formData.caregiverIds, id];

    setFormData({
      ...formData,
      caregiverIds: ids,
      caregiverId: ids[0] || '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/60 bg-background/95 shadow-lg backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
          {/* Role Selection at Top */}
          <div>
            <Label>Role*</Label>
            <Select value={formData.role} onValueChange={handleRoleChange}>
              <SelectTrigger className="rounded-xl border-border/60 bg-background/90">
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

          <div className="flex gap-2">
            <div className="w-40">
              <CountryCodePicker
                value={(formData as any).phone_country || '44'}
                onChange={(code) => setFormData({ ...formData, phone_country: code })}
                label="Country Code"
                placeholder="Search countries..."
              />
            </div>
            <div className="flex-1">
              <Label>Phone Number</Label>
              <Input
                placeholder="Phone number"
                value={(formData as any).phone_number || ''}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              />
            </div>
          </div>

          {/* Caregiver Type/Subtype */}
          {formData.role === 'caregiver' && (
            <div>
              <Label>Caregiver Type</Label>
              <Select value={(formData as any).caregiver_type || ''} onValueChange={(v) => setFormData({ ...formData, caregiver_type: v, caregiver_subtype: '' })}>
                <SelectTrigger className="rounded-xl border-border/60 bg-background/90">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Home Care Assistants">Home Care Assistants</SelectItem>
                  <SelectItem value="Medical/Clinical">Medical/Clinical</SelectItem>
                  <SelectItem value="Therapy/Physical">Therapy/Physical</SelectItem>
                  <SelectItem value="Communication">Communication</SelectItem>
                  <SelectItem value="Day-to-Day/Social">Day-to-Day/Social</SelectItem>
                  <SelectItem value="Nutrition">Nutrition</SelectItem>
                </SelectContent>
              </Select>
              {/* Subtype select depends on type */}
              <div className="mt-2">
                <Label>Caregiver Subtype</Label>
                <Select
                  value={(formData as any).caregiver_subtype || ''}
                  onValueChange={(v) => setFormData({ ...formData, caregiver_subtype: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(caregiverSubtypes[(formData as any).caregiver_type] || []).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Caregiver Selection - For Patient Role */}
          {formData.role === 'patient' && (
            <div>
              <Label>Caregivers (Optional)</Label>

              {formData.caregiverIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2 mt-1">
                  {formData.caregiverIds.map((id) => {
                    const cg = caregivers.find((c) => c._id === id);
                    return cg ? (
                      <div
                        key={id}
                        className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
                      >
                        <span>{cg.full_name}</span>
                        <button
                          onClick={() => toggleCaregiverId(id)}
                          className="hover:text-destructive ml-0.5"
                          aria-label={`Remove ${cg.full_name}`}
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
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-background/90 p-2.5"
                  onClick={() => setShowCaregiverDropdown(!showCaregiverDropdown)}
                >
                  <span className="text-sm text-muted-foreground">
                    {formData.caregiverIds.length > 0
                      ? `${formData.caregiverIds.length} caregiver${formData.caregiverIds.length > 1 ? 's' : ''} selected`
                      : 'Add caregivers...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
                {showCaregiverDropdown && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border/60 bg-background shadow-lg">
                    <Input
                      placeholder="Search caregivers..."
                      value={caregiverSearch}
                      onChange={(e) => setCaregiverSearch(e.target.value)}
                      className="border-0 border-b rounded-none"
                    />
                    <div className="max-h-40 overflow-y-auto">
                      {caregivers.length > 0 ? (
                        caregivers.map((caregiver) => {
                          const selected = formData.caregiverIds.includes(caregiver._id);
                          return (
                          <div
                            key={caregiver._id}
                            className={`p-2.5 hover:bg-muted/50 cursor-pointer text-sm flex items-center justify-between ${selected ? 'bg-primary/5' : ''}`}
                            onClick={() => toggleCaregiverId(caregiver._id)}
                          >
                            <div>
                              <div className="font-medium">{caregiver.full_name}</div>
                              <div className="text-xs text-muted-foreground">{caregiver.email}</div>
                            </div>
                            {selected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                          </div>
                        );
                        })
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
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-background/90 p-2.5"
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
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border/60 bg-background shadow-lg">
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

          <Button onClick={onCreateUser} className="w-full rounded-xl">
            Create User
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
