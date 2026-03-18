import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/datetime';

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUser:
    | (Partial<{
        id: string;
        _id: string;
        email: string | null;
        full_name: string | null;
        role: string | null;
        avatar_url: string | null;
        phone_country: string | null;
        phone_number: string | null;
        address: string | null;
        status: string | null;
        caregiver_type: string | null;
        caregiver_subtype: string | null;
        caregiver_id: string | null;
        corporate_id: string | null;
        family_ids: string[] | null;
        is_geofencing: boolean | null;
        location_boundary: { latitude: number; longitude: number } | null;
        boundary_radius: number | null;
        geofence_state: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>)
    | null;
  roleBadge: (role: string | null) => JSX.Element;
}

export const UserDetailsDialog = ({
  open,
  onOpenChange,
  selectedUser,
  roleBadge,
}: UserDetailsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-background/95 shadow-lg backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {selectedUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-primary">
                    {(selectedUser.full_name || '')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                )}
              </div>
              <div>
                <p className="text-lg font-semibold">{selectedUser.full_name}</p>
                <div className="flex gap-1 mt-1">{roleBadge(selectedUser.role)}</div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/75 p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Email</div>
                  <div className="text-xs">{selectedUser.email || '—'}</div>
                </div>

                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="text-xs">{selectedUser.status || 'unknown'}</div>
                </div>

                <div>
                  <div className="text-muted-foreground">Phone</div>
                  <div className="text-xs">{`${selectedUser.phone_country || ''} ${selectedUser.phone_number || ''}`.trim() || '—'}</div>
                </div>

                <div>
                  <div className="text-muted-foreground">Address</div>
                  <div className="text-xs">{selectedUser.address || '—'}</div>
                </div>
              </div>

              {/* Role-specific details */}
              {selectedUser.role === 'patient' && (
                <div className="border-t border-border/60 pt-2">
                  <div className="text-sm text-muted-foreground mb-1">Geofencing</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Enabled</div>
                      <div>{selectedUser.is_geofencing ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">State</div>
                      <div>{selectedUser.geofence_state || '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Boundary</div>
                      <div>
                        {selectedUser.location_boundary
                          ? `${selectedUser.location_boundary.latitude.toFixed(4)}, ${selectedUser.location_boundary.longitude.toFixed(4)}`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Radius (m)</div>
                      <div>{selectedUser.boundary_radius ?? '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedUser.role === 'caregiver' && (
                <div className="border-t border-border/60 pt-2">
                  <div className="text-sm text-muted-foreground mb-1">Caregiver Details</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Type</div>
                      <div>{selectedUser.caregiver_type || '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Subtype</div>
                      <div>{selectedUser.caregiver_subtype || '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Corporate</div>
                      <div className="text-xs">{selectedUser.corporate_id || '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {(selectedUser.role === 'family' || selectedUser.role === 'admin') && (
                <div className="border-t border-border/60 pt-2">
                  <div className="text-sm text-muted-foreground mb-1">Other</div>
                  <div className="text-xs">Family IDs: {(selectedUser.family_ids && selectedUser.family_ids.length) ? selectedUser.family_ids.join(', ') : '—'}</div>
                </div>
              )}

              <div className="border-t border-border/60 pt-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{selectedUser.created_at ? formatDateTime(selectedUser.created_at) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last updated</span>
                  <span>{selectedUser.updated_at ? formatDateTime(selectedUser.updated_at) : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
