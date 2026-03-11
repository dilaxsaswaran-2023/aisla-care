import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PortalLayout from '@/components/layout/PortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { LayoutDashboard, Shield, Plus, Trash2, Users, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────
interface AdminUser {
  _id: string;
  id: string;
  email: string;
  full_name: string;
  role: string;
  createdAt?: string;
}

interface Stats {
  total: number;
  admins: number;
  caregivers: number;
  patients: number;
  family: number;
  role: string;
  userId: string;
  corporate_id?: string;
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
const navItems = [
  { label: 'Overview', value: 'overview', icon: LayoutDashboard },
  { label: 'Admins',   value: 'admins',   icon: Shield },
];

// ─── Page ────────────────────────────────────────────────────────────────────
const SuperAdmin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats]         = useState<Stats>({ total: 0, admins: 0, caregivers: 0, patients: 0, family: 0, role: '', userId: '' });
  const [admins, setAdmins]       = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Add-admin dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]             = useState({ full_name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();

  // Sync active tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab') || 'overview';
    setActiveTab(tabFromUrl);
  }, [location.search]);

  // Handle tab change and update URL
  const handleTabChange = (tab: string) => {
    navigate(`?tab=${tab}`, { replace: true });
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      api.get(`/users/stats/me`)
        .then(d => setStats(d as Stats))
        .catch(err => console.error('Stats error:', err));
    }
  }, [user?.id]);

  // ── Admins list ────────────────────────────────────────────────────────────
  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const data = await api.get('/users') as AdminUser[];
      setAdmins(data.filter(u => u.role === 'admin'));
    } catch (err: any) {
      toast({ title: 'Failed to load admins', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admins') fetchAdmins();
  }, [activeTab]);

  // ── Add admin ──────────────────────────────────────────────────────────────
  const handleAddAdmin = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      toast({ title: 'All fields are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.post('/users', { ...form, role: 'admin' }) as AdminUser;
      setAdmins(prev => [created, ...prev]);
      setDialogOpen(false);
      setForm({ full_name: '', email: '', password: '' });
      toast({ title: 'Admin created', description: `${form.email} can now log in.` });
      // refresh stats
      if (user?.id) {
        api.get(`/users/stats/me`).then(d => setStats(d as Stats)).catch(() => {});
      }
    } catch (err: any) {
      toast({ title: 'Failed to create admin', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete admin ───────────────────────────────────────────────────────────
  const handleDelete = async (admin: AdminUser) => {
    try {
      await api.delete(`/users/${admin._id || admin.id}`);
      setAdmins(prev => prev.filter(a => (a._id || a.id) !== (admin._id || admin.id)));
      toast({ title: 'Admin removed', description: `${admin.email} has been deleted.` });
      if (user?.id) {
        api.get(`/users/stats/me`).then(d => setStats(d as Stats)).catch(() => {});
      }
    } catch (err: any) {
      toast({ title: 'Failed to delete admin', description: err.message, variant: 'destructive' });
    }
  };

  // ── Page titles ────────────────────────────────────────────────────────────
  const pageTitles: Record<string, { title: string; desc: string }> = {
    overview: { title: 'Super Admin — Overview', desc: 'Platform-wide statistics' },
    admins:   { title: 'Admin Management',       desc: 'Create and manage admin accounts' },
  };
  const current = pageTitles[activeTab] ?? pageTitles.overview;

  return (
    <PortalLayout
      title="AISLA"
      subtitle="Super Admin"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      pageTitle={current.title}
      pageDescription={current.desc}
      headerActions={
        activeTab === 'admins' ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Admin Account</DialogTitle>
                <DialogDescription>
                  Admins can manage caregivers, patients, and family members.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    placeholder="Jane Smith"
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Temporary password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleAddAdmin} disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Admin'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Admins',    value: stats.admins,    icon: Shield,    color: 'text-primary',            tab: 'admins' },
              { label: 'Caregivers',      value: stats.caregivers, icon: UserCheck, color: 'text-success',           tab: null },
              { label: 'Patients',        value: stats.patients,  icon: Users,     color: 'text-warning',            tab: null },
              { label: 'Family Members',  value: stats.family,    icon: Users,     color: 'text-accent-foreground',  tab: null },
            ].map(({ label, value, icon: Icon, color, tab }) => (
              <Card
                key={label}
                className={`care-card p-5 ${tab ? 'cursor-pointer hover:border-primary/30' : ''} transition-all`}
                onClick={() => tab && setActiveTab(tab)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className={`stat-value ${color}`}>{value}</div>
                {tab && <p className="text-xs text-muted-foreground mt-1">Click to manage</p>}
              </Card>
            ))}
          </div>

          <Card className="care-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Platform Summary</CardTitle>
              <CardDescription>All registered users across the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Total Users',    value: stats.total,      color: 'bg-primary/10 text-primary' },
                  { label: 'Admins',         value: stats.admins,     color: 'bg-blue-500/10 text-blue-600' },
                  { label: 'Caregivers',     value: stats.caregivers, color: 'bg-green-500/10 text-green-600' },
                  { label: 'Patients',       value: stats.patients,   color: 'bg-amber-500/10 text-amber-600' },
                  { label: 'Family',         value: stats.family,     color: 'bg-purple-500/10 text-purple-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-lg px-4 py-3 ${color}`}>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-xs font-medium mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ADMINS ── */}
      {activeTab === 'admins' && (
        <Card className="care-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Admin Accounts</CardTitle>
            <CardDescription>
              {admins.length} admin{admins.length !== 1 ? 's' : ''} registered
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingAdmins ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Loading admins…
              </div>
            ) : admins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Shield className="w-10 h-10 opacity-30" />
                <p className="text-sm">No admins yet. Click "Add Admin" to create one.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map(admin => (
                    <TableRow key={admin._id || admin.id}>
                      <TableCell className="font-medium">{admin.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">admin</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Admin</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{admin.full_name}</strong> ({admin.email})?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(admin)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </PortalLayout>
  );
};

export default SuperAdmin;
