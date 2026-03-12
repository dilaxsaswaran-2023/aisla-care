import { useEffect, useRef, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface FirebasePatientAlert {
  id: string;
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
    if (!patientIds.length) {
      return;
    }

    // Firestore "in" queries support max 30 values; chunk if needed
    const chunks: string[][] = [];
    for (let i = 0; i < patientIds.length; i += 30) {
      chunks.push(patientIds.slice(i, i + 30));
    }

    const unsubscribers: (() => void)[] = [];

    for (const chunk of chunks) {
      const q = query(
        collection(db, "patient_alerts"),
        where("patient_id", "in", chunk)
        // Temporarily removed orderBy to avoid index requirement
        // Will add back after index is built: orderBy("created_at", "desc")
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          let docs: FirebasePatientAlert[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<FirebasePatientAlert, "id">),
          }));
          
          // Sort by created_at in memory (since orderBy is temporarily removed)
          docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          setAlerts(docs);

          // Only fire latestAlert for *new* docs arriving after initial load
          if (initialLoadDone.current) {
            for (const change of snapshot.docChanges()) {
              if (change.type === "added") {
                const data = change.doc.data() as Omit<FirebasePatientAlert, "id">;
                setLatestAlert({ id: change.doc.id, ...data });
                break; // only toast for the first new one per batch
              }
            }
          }
          initialLoadDone.current = true;
        },
        () => {
          // Listener error - silently handled
        }
      );
      unsubscribers.push(unsub);
    }

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [patientIds.join(",")]);

  const clearLatest = useCallback(() => setLatestAlert(null), []);

  return { alerts, latestAlert, clearLatest };
}
