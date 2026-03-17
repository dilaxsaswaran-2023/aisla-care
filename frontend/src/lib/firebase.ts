import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Sign in anonymously for Firestore access
export const auth = getAuth(app);

let authReadyPromise: Promise<void> | null = null;

export function ensureFirebaseAuthReady(): Promise<void> {
  if (auth.currentUser) {
    return Promise.resolve();
  }

  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsubscribe();
          resolve();
        }
      });

      signInAnonymously(auth)
        .then(() => {
          resolve();
        })
        .catch((err) => {
          console.error("Firebase anonymous sign-in failed:", err);
          resolve();
        });
    });
  }

  return authReadyPromise;
}

void ensureFirebaseAuthReady();

export default app;
