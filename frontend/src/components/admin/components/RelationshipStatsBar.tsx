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
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
        <div className="text-[10px] text-muted-foreground">Caregivers</div>
        <div className="text-sm font-semibold">{stats.caregiversCount}</div>
      </div>
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
        <div className="text-[10px] text-muted-foreground">Patients Linked</div>
        <div className="text-sm font-semibold">{stats.patientsCount}</div>
      </div>
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
        <div className="text-[10px] text-muted-foreground">Family Members</div>
        <div className="text-sm font-semibold">{stats.familyCount}</div>
      </div>
    </div>
  );
};
