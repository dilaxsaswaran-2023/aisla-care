import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Check, X } from 'lucide-react';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    caregiver_id?: string;
    family_ids?: string[];
  } | null;
  editFormData: {
    fullName: string;
    email: string;
    caregiverId: string;
    familyIds: string[];
    phone_country?: string;
    phone_number?: string;
    caregiver_type?: string;
    caregiver_subtype?: string;
  };
  setEditFormData: (data: any) => void;
  editCaregivers: any[];
  editFamilies: any[];
  editCaregiverSearch: string;
  setEditCaregiverSearch: (search: string) => void;
  editFamilySearch: string;
  setEditFamilySearch: (search: string) => void;
  showEditCaregiverDropdown: boolean;
  setShowEditCaregiverDropdown: (show: boolean) => void;
  showEditFamilyDropdown: boolean;
  setShowEditFamilyDropdown: (show: boolean) => void;
  onSaveChanges: () => Promise<void>;
};

export const EditUserDialog = ({
  open,
  onOpenChange,
  editingUser,
  editFormData,
  setEditFormData,
  editCaregivers,
  editFamilies,
  editCaregiverSearch,
  setEditCaregiverSearch,
  editFamilySearch,
  setEditFamilySearch,
  showEditCaregiverDropdown,
  setShowEditCaregiverDropdown,
  showEditFamilyDropdown,
  setShowEditFamilyDropdown,
  onSaveChanges,
}: EditUserDialogProps) => {
  const toggleFamilyId = (id: string) => {
    const ids = editFormData.familyIds.includes(id)
      ? editFormData.familyIds.filter((i) => i !== id)
      : [...editFormData.familyIds, id];
    setEditFormData({ ...editFormData, familyIds: ids });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-visible">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        {editingUser && (
          <div className="space-y-4 overflow-visible">
            <div>
              <Label>Full Name*</Label>
              <Input
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <Label>Email*</Label>
              <Input
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="Enter email"
              />
            </div>

            <div>
              <Label>Contact</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Country code (e.g. 44)"
                  value={(editFormData as any).phone_country || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone_country: e.target.value })}
                  className="w-28"
                />
                <Input
                  placeholder="Phone number"
                  value={(editFormData as any).phone_number || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                />
              </div>
            </div>

            {editingUser.role === 'caregiver' && (
              <div>
                <Label>Caregiver Type</Label>
                <Select value={(editFormData as any).caregiver_type || ''} onValueChange={(v) => {
                  // clear subtype if type changes
                  setEditFormData({ ...editFormData, caregiver_type: v, caregiver_subtype: '' });
                }}>
                  <SelectTrigger>
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

                <Label className="mt-2">Caregiver Subtype</Label>
                <Select value={(editFormData as any).caregiver_subtype || ''} onValueChange={(v) => setEditFormData({ ...editFormData, caregiver_subtype: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const map: Record<string, string[]> = {
                        'Home Care Assistants': ['Domiciliary Carer', 'Reablement Assistant'],
                        'Medical/Clinical': ['District Nurse', 'Admiral Nurse', 'Stroke Nurse'],
                        'Therapy/Physical': ['Occupational Therapist (OT)', 'Physiotherapist', 'Cognitive Stimulation Therapist'],
                        'Communication': ['Social Worker', 'MH Social Worker', 'SLT'],
                        'Day-to-Day/Social': ['Befriender', 'Companion', 'Respite', 'Support Worker'],
                        'Nutrition': ['Meals on Wheels', 'Cook', 'Dietician'],
                      } as Record<string, string[]>;
                      const opts = map[(editFormData as any).caregiver_type] || [];
                      return opts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>);
                    })()}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Caregiver Selection - For Patient Role */}
            {editingUser.role === 'patient' && (
              <div>
                <Label>Caregiver (Optional)</Label>
                <div className="relative">
                  <div
                    className="border rounded-lg p-2.5 cursor-pointer flex items-center justify-between bg-white"
                    onClick={() => {
                      setShowEditCaregiverDropdown(!showEditCaregiverDropdown);
                      if (!showEditCaregiverDropdown && editCaregivers.length === 0) {
                        (async () => {
                          try {
                            // This would be handled by parent component - keeping for reference
                          } catch (error) {
                            console.error('Error loading caregivers:', error);
                          }
                        })();
                      }
                    }}
                  >
                    <span className="text-sm">
                      {editFormData.caregiverId
                        ? editCaregivers.find((c) => c._id === editFormData.caregiverId)?.full_name || 'Select a caregiver'
                        : 'Select a caregiver'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  {showEditCaregiverDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
                      <Input
                        placeholder="Search caregivers..."
                        value={editCaregiverSearch}
                        onChange={(e) => setEditCaregiverSearch(e.target.value)}
                        className="border-0 border-b rounded-none"
                      />
                      <div className="max-h-40 overflow-y-auto">
                        {editCaregivers.length > 0 ? (
                          editCaregivers.map((caregiver) => (
                            <div
                              key={caregiver._id}
                              className="p-2.5 hover:bg-muted/50 cursor-pointer text-sm"
                              onClick={() => {
                                setEditFormData({ ...editFormData, caregiverId: caregiver._id });
                                setShowEditCaregiverDropdown(false);
                                setEditCaregiverSearch('');
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
            {editingUser.role === 'patient' && (
              <div>
                <Label>Family Members (Optional)</Label>

                {/* Selected chips */}
                {editFormData.familyIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2 mt-1">
                    {editFormData.familyIds.map((id) => {
                      const member = editFamilies.find((f) => f._id === id);
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
                    onClick={() => setShowEditFamilyDropdown(!showEditFamilyDropdown)}
                  >
                    <span className="text-sm text-muted-foreground">
                      {editFormData.familyIds.length > 0
                        ? `${editFormData.familyIds.length} member${editFormData.familyIds.length > 1 ? 's' : ''} selected`
                        : 'Add family members...'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  {showEditFamilyDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
                      <Input
                        placeholder="Search family members..."
                        value={editFamilySearch}
                        onChange={(e) => setEditFamilySearch(e.target.value)}
                        className="border-0 border-b rounded-none"
                      />
                      <div className="max-h-40 overflow-y-auto">
                        {editFamilies.length > 0 ? (
                          editFamilies.map((family) => {
                            const selected = editFormData.familyIds.includes(family._id);
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
            <Button onClick={onSaveChanges} className="w-full">
              Save Changes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
