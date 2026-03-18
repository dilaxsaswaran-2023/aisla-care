interface Stats {
  caregiversCount: number;
  patientsCount: number;
  familyCount: number;
}

interface Props {
  stats: Stats;
}

export const RelationshipStatsBar = ({ stats }: Props) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-sky-500/10 via-background to-background px-3 py-2 shadow-sm">
        <div className="text-[10px] text-muted-foreground">Caregivers</div>
        <div className="text-sm font-semibold">{stats.caregiversCount}</div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-background to-background px-3 py-2 shadow-sm">
        <div className="text-[10px] text-muted-foreground">Patients Linked</div>
        <div className="text-sm font-semibold">{stats.patientsCount}</div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-violet-500/10 via-background to-background px-3 py-2 shadow-sm">
        <div className="text-[10px] text-muted-foreground">Family Members</div>
        <div className="text-sm font-semibold">{stats.familyCount}</div>
      </div>
    </div>
  );
};
