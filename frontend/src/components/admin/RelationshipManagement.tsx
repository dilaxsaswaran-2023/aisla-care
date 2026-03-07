"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Users, Network, TableCellsSplit } from 'lucide-react';
import { RelationshipGraph3D } from './components/RelationshipGraph3D';
import { CaregiverRelationship, UserRow } from './components/types';
import { AddRelationshipDialog } from './components/AddRelationshipDialog';
import { RelationshipStatsBar } from './components/RelationshipStatsBar';
import { RelationshipTableView } from './components/RelationshipTableView';

export const RelationshipManagement = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [relationships, setRelationships] = useState<CaregiverRelationship[]>([]);
  const [patients, setPatients] = useState<UserRow[]>([]);
  const [caregivers, setCaregivers] = useState<UserRow[]>([]);
  const [familyMembers, setFamilyMembers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');

  const [formData, setFormData] = useState<{
    patient_id: string;
    related_user_id: string;
    relationship_type: 'caregiver' | 'family' | 'admin' | 'patient';
  }>({ patient_id: '', related_user_id: '', relationship_type: 'caregiver' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadRelationships(), loadUsers()]);
    setLoading(false);
  };

  const loadRelationships = async () => {
    try {
      const data = await api.get('/relationships');
      setRelationships(data && Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading relationships:', error);
      setRelationships([]);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.get('/users');
      if ((data as any[]) && (data as any[]).length > 0) {
        const usersWithRoles = (data as any[]).map((u: any) => ({ id: u._id || u.id, full_name: u.full_name, role: u.role }));
        setPatients(usersWithRoles.filter((u: any) => u.role === 'patient'));
        setCaregivers(usersWithRoles.filter((u: any) => u.role === 'caregiver'));
        setFamilyMembers(usersWithRoles.filter((u: any) => u.role === 'family'));
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const createRelationship = async () => {
    if (!formData.patient_id || !formData.related_user_id) {
      toast({ title: 'Missing Information', description: 'Please select both a patient and a related user', variant: 'destructive' });
      return;
    }
    try {
      await api.post('/relationships', {
        patient_id: formData.patient_id,
        related_user_id: formData.related_user_id,
        relationship_type: formData.relationship_type,
      });
      toast({ title: 'Success', description: 'Relationship created successfully' });
      setOpen(false);
      setFormData({ patient_id: '', related_user_id: '', relationship_type: 'caregiver' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const stats = useMemo(() => {
    const patientIds = new Set<string>();
    const familyIds = new Set<string>();
    relationships.forEach(rel => {
      rel.patients?.forEach(pf => {
        const pid = pf.patient?._id || pf.patient?.id;
        if (pid) patientIds.add(pid);
        (pf.family_members || []).forEach(fm => {
          const fid = fm?._id || fm?.id;
          if (fid) familyIds.add(fid);
        });
      });
    });
    return { caregiversCount: relationships.length, patientsCount: patientIds.size, familyCount: familyIds.size };
  }, [relationships]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Patient Relationships
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage patient assignments to caregivers and family members</p>
        </div>

        <div className="flex gap-2">
          {isMobile ? (
            <>
              <Button size="sm" variant={viewMode === 'table' ? 'default' : 'outline'} onClick={() => setViewMode('table')}>
                <TableCellsSplit className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant={viewMode === 'graph' ? 'default' : 'outline'} onClick={() => setViewMode('graph')} title="Graph View">
                <Network className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant={viewMode === 'table' ? 'default' : 'outline'} onClick={() => setViewMode('table')} className="gap-1.5">
                <TableCellsSplit className="w-3.5 h-3.5" /> Table View
              </Button>
              <Button size="sm" variant={viewMode === 'graph' ? 'default' : 'outline'} onClick={() => setViewMode('graph')} className="gap-1.5">
                <Network className="w-3.5 h-3.5" /> Graph View
              </Button>
            </>
          )}

          <AddRelationshipDialog
            open={open}
            onOpenChange={setOpen}
            isMobile={isMobile}
            patients={patients}
            caregivers={caregivers}
            familyMembers={familyMembers}
            formData={formData}
            setFormData={setFormData}
            onSubmit={createRelationship}
          />
        </div>
      </div>

      <RelationshipStatsBar stats={stats} />

      <div className="overflow-hidden">
        {viewMode === 'graph' ? (
          loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Loading relationships...</p>
          ) : relationships.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No relationships found. Create users and assign relationships to get started.</p>
          ) : (
            <RelationshipGraph3D relationships={relationships} />
          )
        ) : loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Loading relationships...</p>
        ) : relationships.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No relationships found. Create users and assign relationships to get started.</p>
        ) : (
          <RelationshipTableView relationships={relationships} isMobile={isMobile} onRefresh={loadData} />
        )}
      </div>
    </div>
  );
};
