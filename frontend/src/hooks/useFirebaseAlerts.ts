import { useEffect, useRef, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db, ensureFirebaseAuthReady } from "@/lib/firebase";
import { parseDateTime } from "@/lib/datetime";

export interface FirebasePatientAlert {
  id: string;
  patient_alert_id?: string;
  patient_id: string;
  patient_name?: string;
  event_id: string;
  case: string;
  alert_type: string;
  title: string;
  message: string;
  status: string;
  source: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Listen to the Firestore `patient_alerts` collection for documents
 * matching a given patient_id list (the caregiver's patients).
 *
 * Returns the latest alerts and a per-alert "new alert" callback
 * so the caller can show toasters for freshly arriving docs.
 */
export function useFirebaseAlerts(patientIds: string[]) {
  const [alerts, setAlerts] = useState<FirebasePatientAlert[]>([]);
  const [latestAlert, setLatestAlert] = useState<FirebasePatientAlert | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!patientIds.length) return;

    let disposed = false;
    const unsubscribers: Array<() => void> = [];

    const start = async () => {
      await ensureFirebaseAuthReady();
      if (disposed) return;

      // Firestore "in" queries support max 30 values; chunk if needed
      const chunks: string[][] = [];
      for (let i = 0; i < patientIds.length; i += 30) {
        chunks.push(patientIds.slice(i, i + 30));
      }

      for (const chunk of chunks) {
        const q = query(
          collection(db, "patient_alerts"),
          where("patient_id", "in", chunk)
        );

        const unsub = onSnapshot(
          q,
          (snapshot) => {
            let docs: FirebasePatientAlert[] = snapshot.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              return {
                ...(data as Omit<FirebasePatientAlert, "id">),
                id: d.id,
                patient_alert_id: String((data as any).patient_alert_id || d.id),
              };
            });

            // Sort by created_at in memory (since orderBy is temporarily removed)
            docs.sort((a, b) => (parseDateTime(b.created_at)?.getTime() || 0) - (parseDateTime(a.created_at)?.getTime() || 0));

            setAlerts(docs);

            // Only fire latestAlert for *new* docs arriving after initial load.
            // This avoids replaying older emergency alerts after page refresh.
            if (initialLoadDone.current) {
              for (const change of snapshot.docChanges()) {
                if (change.type === "added") {
                  const data = change.doc.data() as Record<string, unknown>;
                  setLatestAlert({
                    ...(data as Omit<FirebasePatientAlert, "id">),
                    id: change.doc.id,
                    patient_alert_id: String((data as any).patient_alert_id || change.doc.id),
                  });
                  break; // only toast for the first new one per batch
                }
              }
            }
            initialLoadDone.current = true;
          },
          (error) => {
            console.error("[Firebase] patient_alerts listener failed:", error);
          }
        );
        unsubscribers.push(unsub);
      }
    };

    void start();

    return () => {
      disposed = true;
      unsubscribers.forEach((u) => u());
    };
  }, [patientIds.join(",")]);

  const clearLatest = useCallback(() => setLatestAlert(null), []);

  return { alerts, latestAlert, clearLatest };
}
