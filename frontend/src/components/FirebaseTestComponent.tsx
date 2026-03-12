import { useEffect, useState } from "react";
import { useFirebaseAlerts } from "@/hooks/useFirebaseAlerts";

/**
 * Test component to verify Firebase real-time listener works.
 * Shows all alerts received from Firestore and highlights the latest one.
 */
export const FirebaseTestComponent = () => {
  const [testPatientId] = useState("test-patient-001");
  const { alerts, latestAlert } = useFirebaseAlerts([testPatientId]);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  useEffect(() => {
    if (alerts.length > 0) {
      setConnectionStatus(`✓ Connected (${alerts.length} alert${alerts.length !== 1 ? "s" : ""})`);
    } else {
      setConnectionStatus("Connected - waiting for alerts...");
    }
  }, [alerts]);

  return (
    <div className="p-6 border rounded-lg bg-slate-50">
      <h3 className="font-semibold text-lg mb-4">Firebase Real-Time Test</h3>
      
      <div className="mb-4 p-3 rounded bg-blue-50 border border-blue-200">
        <p className="text-sm">
          <strong>Status:</strong> {connectionStatus}
        </p>
        <p className="text-xs text-gray-600 mt-1">Listening for patient: {testPatientId}</p>
      </div>

      {latestAlert && (
        <div className="mb-4 p-4 rounded bg-red-50 border-2 border-red-300">
          <p className="text-sm font-semibold text-red-900">🔥 Latest Alert (just received):</p>
          <pre className="text-xs text-red-800 mt-2 overflow-x-auto">
            {JSON.stringify(latestAlert, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-white border rounded p-4">
        <p className="text-sm font-semibold mb-2">All Alerts from Firestore:</p>
        {alerts.length === 0 ? (
          <p className="text-xs text-gray-500">No alerts received yet. Push one from the backend to test.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="text-xs p-2 bg-gray-50 border rounded">
                <p><strong>{alert.patient_name}</strong> - {alert.title}</p>
                <p className="text-gray-600">{alert.message}</p>
                <p className="text-gray-500 italic">{new Date(alert.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
