import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { UserPlus, Trash2, Edit, RefreshCw, User as UserIcon, Search, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { CreateUserDialog } from './components/CreateUserDialog';
import { UserDetailsDialog } from './components/UserDetailsDialog';
import { EditUserDialog } from './components/EditUserDialog';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status?: 'active' | 'disabled';
  caregiver_id?: string;
  family_ids?: string[];
}

interface DropdownUser {
  _id: string;
  full_name: string;
  email: string;
}

const ROLE_VARIANT_MAP: Record<string, string> = { admin: 'destructive', caregiver: 'success', patient: 'info', family: 'confused' };

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'patient', label: 'Patient' },
  { value: 'family', label: 'Family' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

const roleBadge = (role: string) => {
  return <Badge variant={(ROLE_VARIANT_MAP[role] || 'outline') as any} className="capitalize text-[11px]">{role}</Badge>;
};

export const UserManagement = () => {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [caregivers, setCaregivers] = useState<DropdownUser[]>([]);
  const [families, setFamilies] = useState<DropdownUser[]>([]);
  const [caregiverSearch, setCaregiverSearch] = useState('');
  const [familySearch, setFamilySearch] = useState('');
  const [showCaregiverDropdown, setShowCaregiverDropdown] = useState(false);
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    caregiverId: '',
    familyIds: [] as string[],
  });
  const [editCaregivers, setEditCaregivers] = useState<DropdownUser[]>([]);
  const [editFamilies, setEditFamilies] = useState<DropdownUser[]>([]);
  const [editCaregiverSearch, setEditCaregiverSearch] = useState('');
  const [editFamilySearch, setEditFamilySearch] = useState('');
  const [showEditCaregiverDropdown, setShowEditCaregiverDropdown] = useState(false);
  const [showEditFamilyDropdown, setShowEditFamilyDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusToggleUser, setStatusToggleUser] = useState<User | null>(null);
  const [statusToggleOpen, setStatusToggleOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'caregiver',
    caregiverId: '',
    familyIds: [] as string[],
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = () => {
      setRoleDropdownOpen(false);
      setStatusDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadUsers = async () => {
    try {
      // Fetch users under the admin's corporate_id (admin's ID is their corporate_id)
      const data = await api.get(`/users/corporate/${authUser?.id}`);
      setUsers(
        data && Array.isArray(data) && data.length > 0
          ? data.map((u: any) => ({
              id: u._id || u.id,
              full_name: u.full_name,
              email: u.email || '',
              role: u.role,
              status: u.status || 'active',
              caregiver_id: u.caregiver_id,
              family_ids: Array.isArray(u.family_ids) ? u.family_ids : [],
              patient_id: u.patient_id,
            }))
          : []
      );
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const loadCaregivers = useCallback(async (search: string = '') => {
    try {
      const data = await api.get(`/users/caregivers-list${search ? `?search=${search}` : ''}`);
      setCaregivers((data as DropdownUser[]) || []);
    } catch (error) {
      console.error('Error loading caregivers:', error);
      setCaregivers([]);
    }
  }, []);

  const loadFamilies = useCallback(async (search: string = '') => {
    try {
      const data = await api.get(`/users/family-list${search ? `?search=${search}` : ''}`);
      setFamilies((data as DropdownUser[]) || []);
    } catch (error) {
      console.error('Error loading families:', error);
      setFamilies([]);
    }
  }, []);

  const handleRoleChange = (newRole: string) => {
    setFormData({
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      role: newRole,
      caregiverId: '',
      familyIds: [],
    });

    // Auto-load caregivers if patient role is selected
    if (newRole === 'patient') {
      loadCaregivers();
      loadFamilies();
    }
  };

  const handleCaregiverSearchChange = (search: string) => {
    setCaregiverSearch(search);
    loadCaregivers(search);
  };

  const handlePatientSearchChange = (search: string) => {
    setFamilySearch(search);
    loadFamilies(search);
  };

  const handleEditClick = async (user: User) => {
    setEditingUser(user);
    setEditFormData({
      fullName: user.full_name,
      email: user.email,
      caregiverId: user.caregiver_id || '',
      familyIds: user.family_ids || [],
    });
    setEditCaregiverSearch('');
    setEditFamilySearch('');
    setShowEditCaregiverDropdown(false);
    setShowEditFamilyDropdown(false);
    
    // Load caregivers and families if editing a patient (before opening dialog)
    if (user.role === 'patient') {
      try {
        const caregiversData = await api.get('/users/caregivers-list');
        setEditCaregivers((caregiversData as DropdownUser[]) || []);
        const familiesData = await api.get('/users/family-list');
        setEditFamilies((familiesData as DropdownUser[]) || []);
      } catch (error) {
        console.error('Error loading caregivers/families:', error);
      }
    }
    setEditOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    try {
      await api.delete(`/users/${id}`);
      toast({ title: 'Success', description: 'User deleted successfully' });
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const saveUserChanges = async () => {
    if (!editingUser || !editFormData.fullName || !editFormData.email) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      const payload: any = {
        full_name: editFormData.fullName,
        email: editFormData.email,
      };
      
      // Add caregiver and family IDs if editing a patient
      if (editingUser.role === 'patient') {
        if (editFormData.caregiverId) {
          payload.caregiver_id = editFormData.caregiverId;
        }
        payload.family_ids = editFormData.familyIds;
      }
      
      await api.put(`/users/${editingUser.id}`, payload);
      
      toast({ title: 'Success', description: 'User updated successfully' });
      setEditOpen(false);
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const selectCaregiver = (caregiver: DropdownUser) => {
    setFormData({ ...formData, caregiverId: caregiver._id });
    setShowCaregiverDropdown(false);
    setCaregiverSearch('');
  };

  const selectFamily = (family: DropdownUser) => {
    // Toggle family member in/out of familyIds array
    const ids = formData.familyIds.includes(family._id)
      ? formData.familyIds.filter((id) => id !== family._id)
      : [...formData.familyIds, family._id];
    setFormData({ ...formData, familyIds: ids });
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
        role: formData.role,
      };

      if (formData.role === 'patient' && formData.caregiverId) {
        payload.caregiver_id = formData.caregiverId;
      }

      if (formData.role === 'patient') {
        payload.family_ids = formData.familyIds;
      }

      await api.post('/users', payload);
      toast({ title: 'Success', description: 'User created successfully' });
      setOpen(false);
      setFormData({
        email: '',
        password: '',
        fullName: '',
        role: 'caregiver',
        caregiverId: '',
        familyIds: [],
      });
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddUserClick = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'caregiver',
      caregiverId: '',
      familyIds: [],
    });
    setCaregiverSearch('');
    setFamilySearch('');
    setShowCaregiverDropdown(false);
    setShowFamilyDropdown(false);
    setOpen(true);
  };

  const toggleUserStatus = async () => {
    if (!statusToggleUser) return;
    
    try {
      const newStatus = statusToggleUser.status === 'active' ? 'disabled' : 'active';
      await api.put(`/users/${statusToggleUser.id}/status`, { status: newStatus });
      toast({ title: 'Success', description: `User status changed to ${newStatus}` });
      setStatusToggleOpen(false);
      setStatusToggleUser(null);
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };
  // Compute filtered users based on search and filters
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.full_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-base'}`}>
            <UserIcon className="w-4 h-4 text-primary" />
            User Management
          </h3>
          <p className={`text-muted-foreground mt-0.5 ${isMobile ? 'text-[11px]' : 'text-xs'}`}>{filteredUsers.length} of {users.length} users</p>
        </div>
        <div className="flex gap-2">
          {isMobile ? (
            <>
              <Button variant="outline" size="icon" onClick={loadUsers} title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button size="icon" onClick={handleAddUserClick} title="Add User">
                <UserPlus className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={loadUsers} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
              <Button size="sm" className="gap-1.5" onClick={handleAddUserClick}>
                <UserPlus className="w-3.5 h-3.5" />
                Add User
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="care-card overflow-hidden">
        {/* Search Bar */}
        <div className={`border-b border-muted ${isMobile ? 'p-2' : 'p-4'}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 ${isMobile ? 'text-xs h-8' : ''}`}
            />
          </div>
        </div>

        <Table className={isMobile ? 'table-fixed w-full' : 'w-full'}>
          <TableHeader>
            <TableRow className={`bg-muted/30 ${isMobile ? '[&>th]:px-2 [&>th]:py-2' : ''}`}>
              <TableHead className={isMobile ? 'w-5/12 px-2' : ''}>Name</TableHead>
              <TableHead className={`relative ${isMobile ? 'w-2/12 px-2' : ''}`}>
                <div className={`flex items-center gap-2 ${isMobile ? 'gap-0' : ''}`}>
                    <span className={isMobile ? 'text-xs' : ''}>Role</span>
                    <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoleDropdownOpen(!roleDropdownOpen);
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    aria-label="Filter by role"
                    >
                      <Filter className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-muted-foreground`} />
                    </button>
                  {roleDropdownOpen && (
                    <div className="absolute top-full left-0 mt-0 bg-white border border-muted rounded shadow-lg z-50 min-w-32" onClick={(e) => e.stopPropagation()}>
                      {ROLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setRoleFilter(opt.value); setRoleDropdownOpen(false); }}
                          className={`block w-full text-left px-4 py-2 text-sm hover:bg-muted ${roleFilter === opt.value ? 'bg-muted/50 font-semibold' : ''}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </TableHead>
              <TableHead className={`relative ${isMobile ? 'w-2/12 px-2' : ''}`}>
                <div className={`flex items-center gap-2 ${isMobile ? 'gap-0' : ''}`}>
                  <span className={isMobile ? 'text-xs' : ''}>Status</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusDropdownOpen(!statusDropdownOpen);
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    aria-label="Filter by status"
                  >
                    <Filter className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-muted-foreground`} />
                  </button>
                  {statusDropdownOpen && (
                    <div className="absolute top-full left-0 mt-0 bg-white border border-muted rounded shadow-lg z-50 min-w-32" onClick={(e) => e.stopPropagation()}>
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setStatusFilter(opt.value); setStatusDropdownOpen(false); }}
                          className={`block w-full text-left px-4 py-2 text-sm hover:bg-muted ${statusFilter === opt.value ? 'bg-muted/50 font-semibold' : ''}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </TableHead>
              <TableHead className={`${isMobile ? 'w-3/12 px-2 text-right' : 'text-right'}`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No users found. {users.length > 0 ? 'Try adjusting your filters.' : 'Create users to get started.'}</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((u: User) => (
              <TableRow
                key={u.id}
                className={`cursor-pointer hover:bg-muted/30 ${isMobile ? '[&>td]:px-2 [&>td]:py-1.5' : ''}`}
                onClick={() => {
                  setSelectedUser(u);
                  setDetailsOpen(true);
                }}
              >
                <TableCell className={`${isMobile ? 'px-2 w-5/12' : ''}`}>
                  <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-3'}`}>
                    <div className={`rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`}>
                      <span className={`font-semibold text-primary ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                        {u.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </span>
                    </div>
                    <span className={`font-medium ${isMobile ? 'text-[12px]' : 'text-sm'}`}>{u.full_name}</span>
                  </div>
                </TableCell>
                <TableCell className={`${isMobile ? 'px-2 w-2/12' : ''}`}>
                  {isMobile ? (
                    <Badge variant={(ROLE_VARIANT_MAP[u.role] || 'outline') as any} className={`${isMobile ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px]'}`}>
                      {u.role.charAt(0).toUpperCase()}
                    </Badge>
                  ) : (
                    roleBadge(u.role)
                  )}
                </TableCell>
                <TableCell className={`${isMobile ? 'px-2 w-2/12' : ''}`} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setStatusToggleUser(u);
                      setStatusToggleOpen(true);
                    }}
                    className="cursor-pointer"
                    title="Click to toggle status"
                  >
                    <Badge
                      variant={u.status === 'active' ? 'secondary' : 'destructive'}
                      className={`gap-1 ${isMobile ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px]'}`}
                    >
                      <span className={`rounded-full ${u.status === 'active' ? 'bg-green-500' : 'bg-red-500'} ${isMobile ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} />
                      {isMobile ? u.status.charAt(0).toUpperCase() : u.status}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className={isMobile ? 'px-0 w-3/12' : 'text-right'} onClick={(e) => e.stopPropagation()}>
                  <div className={`w-full flex ${isMobile ? 'justify-end gap-0.5 px-2 py-1.5' : 'justify-end gap-1'}`}>
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(u)} title="Edit user" className={isMobile ? 'p-1 h-auto' : ''}>
                      <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(u.id)} title="Delete user" className={isMobile ? 'p-1 h-auto' : ''}>
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Components */}
      <CreateUserDialog
        open={open}
        onOpenChange={setOpen}
        formData={formData}
        setFormData={setFormData}
        caregivers={caregivers}
        families={families}
        caregiverSearch={caregiverSearch}
        setCaregiverSearch={setCaregiverSearch}
        familySearch={familySearch}
        setFamilySearch={setFamilySearch}
        showCaregiverDropdown={showCaregiverDropdown}
        setShowCaregiverDropdown={setShowCaregiverDropdown}
        showFamilyDropdown={showFamilyDropdown}
        setShowFamilyDropdown={setShowFamilyDropdown}
        handleRoleChange={handleRoleChange}
        onCreateUser={createUser}
      />

      <UserDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        selectedUser={selectedUser}
        roleBadge={roleBadge}
      />

      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editingUser={editingUser}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        editCaregivers={editCaregivers}
        editFamilies={editFamilies}
        editCaregiverSearch={editCaregiverSearch}
        setEditCaregiverSearch={setEditCaregiverSearch}
        editFamilySearch={editFamilySearch}
        setEditFamilySearch={setEditFamilySearch}
        showEditCaregiverDropdown={showEditCaregiverDropdown}
        setShowEditCaregiverDropdown={setShowEditCaregiverDropdown}
        showEditFamilyDropdown={showEditFamilyDropdown}
        setShowEditFamilyDropdown={setShowEditFamilyDropdown}
        onSaveChanges={saveUserChanges}
      />

      {/* Status Toggle Confirmation Dialog */}
      <AlertDialog open={statusToggleOpen} onOpenChange={setStatusToggleOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Toggle User Status</AlertDialogTitle>
          <AlertDialogDescription>
            {statusToggleUser && (
              <>
                Are you sure you want to change <strong>{statusToggleUser.full_name}</strong>'s status from{' '}
                <strong>{statusToggleUser.status === 'active' ? 'Active' : 'Disabled'}</strong> to{' '}
                <strong>{statusToggleUser.status === 'active' ? 'Disabled' : 'Active'}</strong>?
              </>
            )}
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={toggleUserStatus}>
              Confirm
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
