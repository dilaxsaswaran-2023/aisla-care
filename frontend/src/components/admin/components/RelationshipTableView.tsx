import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ChevronRight, User, HeartHandshake } from 'lucide-react';
import { CaregiverRelationship, UserInfo } from './types';

type Tab = 'caregiver' | 'patient' | 'family';

interface Props {
  relationships: CaregiverRelationship[];
  isMobile: boolean;
  onRefresh: () => void;
}

export const RelationshipTableView = ({ relationships, isMobile, onRefresh }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>('caregiver');
  const [entityQuery, setEntityQuery] = useState('');
  const [selected, setSelected] = useState<Record<Tab, string | undefined>>({
    caregiver: undefined,
    patient: undefined,
    family: undefined,
  });

  // ── derived views ───────────────────────────────────────────────────────────

  const patientView = useMemo(() => {
    const map: Record<string, { patient: UserInfo; caregivers: UserInfo[]; family_members: UserInfo[] }> = {};
    relationships.forEach((rel) => {
      rel.patients.forEach((pf) => {
        const pid = pf.patient._id || pf.patient.id || '';
        if (!pid) return;
        if (!map[pid]) map[pid] = { patient: pf.patient, caregivers: [], family_members: pf.family_members || [] };
        if (!map[pid].caregivers.some((c) => (c._id || c.id) === (rel.caregiver._id || rel.caregiver.id)))
          map[pid].caregivers.push(rel.caregiver);
        (pf.family_members || []).forEach((fm) => {
          if (!map[pid].family_members.some((f) => (f._id || f.id) === (fm._id || fm.id)))
            map[pid].family_members.push(fm);
        });
      });
    });
    return Object.values(map);
  }, [relationships]);

  const familyView = useMemo(() => {
    const map: Record<string, { family: UserInfo; patients: UserInfo[]; caregivers: UserInfo[] }> = {};
    relationships.forEach((rel) => {
      rel.patients.forEach((pf) => {
        (pf.family_members || []).forEach((fm) => {
          const fid = fm._id || fm.id || '';
          if (!fid) return;
          if (!map[fid]) map[fid] = { family: fm, patients: [], caregivers: [] };
          if (!map[fid].patients.some((p) => (p._id || p.id) === (pf.patient._id || pf.patient.id)))
            map[fid].patients.push(pf.patient);
          if (!map[fid].caregivers.some((c) => (c._id || c.id) === (rel.caregiver._id || rel.caregiver.id)))
            map[fid].caregivers.push(rel.caregiver);
        });
      });
    });
    return Object.values(map);
  }, [relationships]);

  const caregiverListBase = useMemo(
    () =>
      relationships.map((rel) => ({
        id: (rel.caregiver._id || rel.caregiver.id || '') as string,
        name: rel.caregiver.full_name,
        sub: rel.caregiver.email,
        count: rel.patients?.length || 0,
      })),
    [relationships]
  );

  const patientListBase = useMemo(
    () =>
      patientView.map((e) => ({
        id: (e.patient._id || e.patient.id || '') as string,
        name: e.patient.full_name,
        sub: e.patient.email,
        caregiversCount: e.caregivers.length,
        familyCount: e.family_members?.length || 0,
      })),
    [patientView]
  );

  const familyListBase = useMemo(
    () =>
      familyView.map((e) => ({
        id: (e.family._id || e.family.id || '') as string,
        name: e.family.full_name,
        sub: e.family.email,
        patientsCount: e.patients.length,
        caregiversCount: e.caregivers.length,
      })),
    [familyView]
  );

  // auto-select first item when tab/data changes
  useEffect(() => {
    const base =
      activeTab === 'caregiver' ? caregiverListBase : activeTab === 'patient' ? patientListBase : familyListBase;
    const sid = selected[activeTab];
    const exists = !!sid && base.some((i) => i.id === sid);
    if (!exists && base.length > 0) setSelected((prev) => ({ ...prev, [activeTab]: base[0].id }));
  }, [activeTab, caregiverListBase, patientListBase, familyListBase]);

  const activeList = useMemo(() => {
    const q = entityQuery.trim().toLowerCase();
    const base =
      activeTab === 'caregiver' ? caregiverListBase : activeTab === 'patient' ? patientListBase : familyListBase;
    if (!q) return base;
    return base.filter((i) => (i.name || '').toLowerCase().includes(q) || (i.sub || '').toLowerCase().includes(q));
  }, [entityQuery, activeTab, caregiverListBase, patientListBase, familyListBase]);

  const selectedId = selected[activeTab];

  const selectedCaregiverRel = useMemo(() => {
    if (activeTab !== 'caregiver' || !selectedId) return null;
    return relationships.find((r) => (r.caregiver._id || r.caregiver.id) === selectedId) || null;
  }, [activeTab, selectedId, relationships]);

  const selectedPatientEntry = useMemo(() => {
    if (activeTab !== 'patient' || !selectedId) return null;
    return patientView.find((e) => (e.patient._id || e.patient.id) === selectedId) || null;
  }, [activeTab, selectedId, patientView]);

  const selectedFamilyEntry = useMemo(() => {
    if (activeTab !== 'family' || !selectedId) return null;
    return familyView.find((e) => (e.family._id || e.family.id) === selectedId) || null;
  }, [activeTab, selectedId, familyView]);

  const exploringLabel = activeTab === 'caregiver' ? 'Caregivers' : activeTab === 'patient' ? 'Patients' : 'Family Members';
  const exploringChip =
    activeTab === 'caregiver'
      ? 'Exploring Caregiver Relationships'
      : activeTab === 'patient'
      ? 'Exploring Patient Connections'
      : 'Exploring Family Connections';

  // ── tab toggle helper ────────────────────────────────────────────────────────
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setEntityQuery('');
  };

  return (
    <>
      {/* Tab Bar */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/80 p-2 shadow-sm">
        <div className="flex w-full gap-2 border-b border-border/60">
          {(['caregiver', 'patient', 'family'] as Tab[]).map((tab) => {
            const count =
              tab === 'caregiver' ? caregiverListBase.length : tab === 'patient' ? patientListBase.length : familyListBase.length;
            const label = tab === 'caregiver' ? 'Caregivers' : tab === 'patient' ? 'Patients' : 'Family Members';
            return (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className={`rounded-t-xl px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab ? 'border-b-2 border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'}`}
              >
                {label}
                <span
                  className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] ${activeTab === tab ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground'}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column explorer + details */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-12'}`}>
        {/* ── Explorer Panel ─────────────────────────────────────────────────── */}
        <div className={`${isMobile ? '' : 'lg:col-span-4'} overflow-hidden rounded-2xl border border-border/60 bg-background/85 shadow-sm`}>
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-background via-primary/5 to-background px-3 py-2">
            <div className="text-sm font-semibold">Relationship Explorer</div>
            <Badge variant="secondary" className="text-xs">{activeList.length}</Badge>
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <Badge variant="outline" className="text-[10px]">{exploringLabel}</Badge>
            <Badge variant="secondary" className="text-[10px]">{exploringChip}</Badge>
          </div>

          <div className="border-b border-border/60 p-3">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
              <Input
                value={entityQuery}
                onChange={(e) => setEntityQuery(e.target.value)}
                placeholder={`Search ${activeTab}s...`}
                className="h-9 rounded-xl border-border/60 bg-background/90 pl-8"
              />
            </div>
          </div>

          <div className={`${isMobile ? 'max-h-[300px]' : 'max-h-[520px]'} overflow-auto`}>
            {activeList.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No matches.</div>
            ) : (
              activeList.map((i: any) => (
                <button
                  key={i.id}
                  onClick={() => setSelected((prev) => ({ ...prev, [activeTab]: i.id }))}
                  className={`w-full border-b border-border/60 border-l-2 px-3 py-3 text-left transition-colors ${selectedId === i.id ? 'border-l-primary bg-primary/10' : 'border-l-transparent hover:bg-muted/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary">
                        {(i.name || '?').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{i.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{i.sub}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {activeTab === 'patient' ? (
                        <Badge variant="outline" className="text-[10px]">{i.caregiversCount ?? 0}C • {i.familyCount ?? 0}F</Badge>
                      ) : activeTab === 'family' ? (
                        <Badge variant="outline" className="text-[10px]">{i.caregiversCount ?? 0}C • {i.patientsCount ?? 0}P</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{i.count ?? 0}P</Badge>
                      )}
                      <ChevronRight className={`w-4 h-4 ${selectedId === i.id ? 'text-foreground' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Detail Panel ───────────────────────────────────────────────────── */}
        <div className={`${isMobile ? '' : 'lg:col-span-8'} overflow-hidden rounded-2xl border border-border/60 bg-background/85 shadow-sm`}>
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-background via-primary/5 to-background px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">
                {activeTab === 'caregiver' ? 'Caregiver Details' : activeTab === 'patient' ? 'Patient Details' : 'Family Details'}
              </div>
              <Badge variant="secondary" className="text-xs">{exploringLabel}</Badge>
            </div>
            <Button size="sm" variant="outline" onClick={onRefresh} className="h-8 rounded-xl border-border/60 bg-background/90 px-2.5">Refresh</Button>
          </div>

          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Badge variant="outline" className="text-[10px] gap-1"><HeartHandshake className="w-3 h-3" /> Active exploration</Badge>
            <Badge variant="secondary" className="text-[10px]">{activeTab.toUpperCase()}</Badge>
            <Badge variant="outline" className="text-[10px]">{selectedId ? 'Selected' : 'Not selected'}</Badge>
          </div>

          <div className="p-4">
            {/* Caregiver detail */}
            {activeTab === 'caregiver' && (
              !selectedCaregiverRel ? (
                <div className="text-sm text-muted-foreground">Select a caregiver to view linked patients and family members.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold truncate">{selectedCaregiverRel.caregiver.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{selectedCaregiverRel.caregiver.email}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs">{selectedCaregiverRel.patients.length} Patients</Badge>
                      <Badge variant="outline" className="text-xs">
                        {selectedCaregiverRel.patients.reduce((a, p) => a + ((p.family_members || []).length || 0), 0)} Family Links
                      </Badge>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Patient</TableHead>
                          <TableHead>Family Member(s)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCaregiverRel.patients.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-8">No patients assigned</TableCell>
                          </TableRow>
                        ) : (
                          selectedCaregiverRel.patients.map((pf, idx) => (
                            <TableRow key={`${selectedCaregiverRel.caregiver._id || selectedCaregiverRel.caregiver.id}-${pf.patient._id || pf.patient.id}-${idx}`}>
                              <TableCell className="text-sm font-medium">{pf.patient.full_name}</TableCell>
                              <TableCell className="text-sm">
                                {pf.family_members && pf.family_members.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {pf.family_members.map((fm) => (
                                      <Badge key={fm._id || fm.id} variant="outline" className="text-xs">{fm.full_name}</Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not assigned</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            )}

            {/* Patient detail */}
            {activeTab === 'patient' && (
              !selectedPatientEntry ? (
                <div className="text-sm text-muted-foreground">Select a patient to view connected caregivers and family members.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold truncate">{selectedPatientEntry.patient.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{selectedPatientEntry.patient.email}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs">{selectedPatientEntry.caregivers.length} Caregivers</Badge>
                      <Badge variant="outline" className="text-xs">{selectedPatientEntry.family_members?.length || 0} Family</Badge>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90">
                    <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" /> Relationship Map
                      </div>
                      <Badge variant="secondary" className="text-xs">Live view</Badge>
                    </div>

                    <div className="p-4">
                      <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                        <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
                          <div className="text-xs font-semibold mb-2">Caregivers</div>
                          {selectedPatientEntry.caregivers.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {selectedPatientEntry.caregivers.map((c) => (
                                <Badge key={c._id || c.id} variant="secondary" className="text-xs">{c.full_name}</Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">No caregivers assigned</div>
                          )}
                        </div>

                        <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-muted/10 p-3">
                          <div className="text-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-sm font-semibold text-primary">
                              {selectedPatientEntry.patient.full_name.charAt(0)}
                            </div>
                            <div className="text-sm font-semibold">{selectedPatientEntry.patient.full_name}</div>
                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><ChevronRight className="w-3 h-3" />care</span>
                              <span className="inline-flex items-center gap-1"><ChevronRight className="w-3 h-3" />family</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
                          <div className="text-xs font-semibold mb-2">Family Members</div>
                          {selectedPatientEntry.family_members && selectedPatientEntry.family_members.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {selectedPatientEntry.family_members.map((fm) => (
                                <Badge key={fm._id || fm.id} variant="outline" className="text-xs">{fm.full_name}</Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">Not assigned</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
                        <div className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>Currently exploring: <span className="text-foreground font-medium">Patient</span></span>
                          <span>{selectedPatientEntry.caregivers.length} caregiver(s) • {selectedPatientEntry.family_members?.length || 0} family member(s)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90">
                      <div className="border-b border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium">Caregivers</div>
                      <div className="p-3">
                        {selectedPatientEntry.caregivers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedPatientEntry.caregivers.map((c) => (
                              <Badge key={c._id || c.id} variant="secondary" className="text-xs">{c.full_name}</Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">No caregivers assigned</div>
                        )}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90">
                      <div className="border-b border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium">Family Members</div>
                      <div className="p-3">
                        {selectedPatientEntry.family_members && selectedPatientEntry.family_members.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedPatientEntry.family_members.map((fm) => (
                              <Badge key={fm._id || fm.id} variant="outline" className="text-xs">{fm.full_name}</Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Not assigned</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Family detail */}
            {activeTab === 'family' && (
              !selectedFamilyEntry ? (
                <div className="text-sm text-muted-foreground">Select a family member to view linked patients and caregivers.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold truncate">{selectedFamilyEntry.family.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{selectedFamilyEntry.family.email}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs">{selectedFamilyEntry.patients.length} Patients</Badge>
                      <Badge variant="outline" className="text-xs">{selectedFamilyEntry.caregivers.length} Caregivers</Badge>
                    </div>
                  </div>

                  <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="px-3 py-2 bg-muted/30 border-b border-border text-sm font-medium">Patients</div>
                      <div className="p-3">
                        {selectedFamilyEntry.patients.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedFamilyEntry.patients.map((p) => (
                              <Badge key={p._id || p.id} variant="secondary" className="text-xs">{p.full_name}</Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">No patients assigned</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="px-3 py-2 bg-muted/30 border-b border-border text-sm font-medium">Caregivers</div>
                      <div className="p-3">
                        {selectedFamilyEntry.caregivers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedFamilyEntry.caregivers.map((c) => (
                              <Badge key={c._id || c.id} variant="outline" className="text-xs">{c.full_name}</Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">No caregivers assigned</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Patient</TableHead>
                          <TableHead>Caregiver(s)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedFamilyEntry.patients.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-8">No patients assigned</TableCell>
                          </TableRow>
                        ) : (
                          selectedFamilyEntry.patients.map((p) => (
                            <TableRow key={p._id || p.id}>
                              <TableCell className="text-sm font-medium">{p.full_name}</TableCell>
                              <TableCell className="text-sm">
                                {selectedFamilyEntry.caregivers.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {selectedFamilyEntry.caregivers.map((c) => (
                                      <Badge key={c._id || c.id} variant="outline" className="text-xs">{c.full_name}</Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No caregivers assigned</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
};
