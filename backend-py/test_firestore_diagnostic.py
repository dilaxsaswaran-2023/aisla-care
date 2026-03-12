#!/usr/bin/env python
"""Diagnostic script to test Firestore push and rules."""
import os
import sys
import datetime
import uuid
import json

os.environ['FIREBASE_SERVICE_ACCOUNT_PATH'] = 'firebase-service-account.json'
sys.path.insert(0, '.')

from app.services.firebase_helper import push_patient_alert

# Push a test doc with a unique ID
test_alert = {
    'id': f'diag-{uuid.uuid4()}',
    'patient_id': 'diag-patient-001',
    'patient_name': 'Diagnostic Test',
    'event_id': None,
    'case': 'TEST',
    'alert_type': 'TEST',
    'title': 'Diagnostic message for rules testing',
    'message': 'If you see this in the browser, the Firestore rules are working correctly',
    'status': 'active',
    'source': 'test',
    'is_read': False,
    'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat()
}

print("\n" + "="*70)
print("FIRESTORE DIAGNOSTIC TEST")
print("="*70)

result = push_patient_alert(test_alert)

if result:
    print("[OK] Successfully pushed test document to Firestore")
    print("\nDocument Details:")
    print(f"  ID:          {test_alert['id']}")
    print(f"  Patient ID:  {test_alert['patient_id']}")
    print(f"  Title:       {test_alert['title']}")
    print("\nNEXT STEPS:")
    print("  1. Go to the frontend test page: http://localhost:8030/firebase-test")
    print("  2. Open Browser DevTools (F12) > Console tab")
    print("  3. Look for logs starting with '[Firebase]'")
    print("\nIf you still see 'permission-denied' errors:")
    print("  * Go to Firebase Console > Firestore Database > Rules")
    print("  * Replace ALL rules with this and click PUBLISH:")
    print("\n" + "-"*70)
    print("""rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}""")
    print("-"*70)
    print("\n  * Wait 10-30 seconds for the rules to propagate")
    print("  * Hard refresh the test page (Ctrl+Shift+R or Cmd+Shift+R)")
else:
    print("[ERROR] Failed to push to Firestore - check backend logs")

print("\n" + "="*70 + "\n")
