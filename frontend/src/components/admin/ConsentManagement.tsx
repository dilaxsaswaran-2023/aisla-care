import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, X, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: string;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const sampleConsents: ConsentRecord[] = [
  { id: 's-1', user_id: 'user-1', consent_type: 'data_processing', granted: true, granted_at: '2025-01-15T10:30:00Z', revoked_at: null, created_at: '2025-01-15T10:30:00Z' },
  { id: 's-2', user_id: 'user-1', consent_type: 'location_tracking', granted: true, granted_at: '2025-01-15T10:31:00Z', revoked_at: null, created_at: '2025-01-15T10:31:00Z' },
  { id: 's-3', user_id: 'user-2', consent_type: 'camera_monitoring', granted: true, granted_at: '2025-01-20T14:00:00Z', revoked_at: null, created_at: '2025-01-20T14:00:00Z' },
  { id: 's-4', user_id: 'user-2', consent_type: 'health_data', granted: false, granted_at: '2025-01-20T14:01:00Z', revoked_at: '2025-02-10T09:00:00Z', created_at: '2025-01-20T14:01:00Z' },
  { id: 's-5', user_id: 'user-3', consent_type: 'third_party_sharing', granted: false, granted_at: null, revoked_at: null, created_at: '2025-02-01T08:00:00Z' },
];

const ConsentManagement = () => {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { loadConsents(); }, []);

  const loadConsents = async () => {
    try {
      const data = await api.get('/consent-records');
      setConsents(data && data.length > 0 ? data : sampleConsents);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load consent records", variant: "destructive" });
      setConsents(sampleConsents);
    }
    setLoading(false);
  };

  const typeLabels: Record<string, string> = {
    'data_processing': 'Data Processing', 'location_tracking': 'Location Tracking',
    'camera_monitoring': 'Camera Monitoring', 'health_data': 'Health Data Sharing',
    'third_party_sharing': 'Third-Party Sharing',
  };

  const isSample = consents === sampleConsents;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />GDPR Consent Management
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">User consent records for data processing and privacy compliance</p>
      </div>

      {isSample && (
        <div className="bg-accent/50 border border-primary/10 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Showing sample consent data — real records will appear as users grant consents.</p>
        </div>
      )}

      {loading ? (
        <Card className="care-card"><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading consent records...</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {consents.map((consent) => (
            <Card key={consent.id} className="care-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    {typeLabels[consent.consent_type] || consent.consent_type}
                  </span>
                  <Badge variant={consent.granted ? "default" : "secondary"} className="text-[11px]">
                    {consent.granted ? <><Check className="w-3 h-3 mr-1" />Granted</> : <><X className="w-3 h-3 mr-1" />Revoked</>}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {consent.granted && consent.granted_at
                      ? `Granted: ${new Date(consent.granted_at).toLocaleDateString()}`
                      : consent.revoked_at
                      ? `Revoked: ${new Date(consent.revoked_at).toLocaleDateString()}`
                      : `Created: ${new Date(consent.created_at).toLocaleDateString()}`
                    }
                  </div>
                  <p>User: {consent.user_id.substring(0, 8)}...</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsentManagement;
