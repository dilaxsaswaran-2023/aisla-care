import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, getDocs, onSnapshot, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ensureFirebaseAuthReady } from "@/lib/firebase";
import { parseDateTime } from "@/lib/datetime";

export interface FirebaseChatNotification {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  content: string;
  message_type: "text" | "audio";
  is_read: boolean;
  created_at: string;
}

export async function createFirebaseChatNotification(payload: Omit<FirebaseChatNotification, "id">) {
  await ensureFirebaseAuthReady();
  await addDoc(collection(db, "chat_notifications"), payload);
}

export function useFirebaseChatNotifications(userId: string | null, activePartnerId?: string | null) {
  const [notifications, setNotifications] = useState<FirebaseChatNotification[]>([]);
  const [latestNotification, setLatestNotification] = useState<FirebaseChatNotification | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLatestNotification(null);
      return;
    }

    const q = query(collection(db, "chat_notifications"), where("recipient_id", "==", userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<FirebaseChatNotification, "id">),
          }))
          .filter((item) => item.recipient_id === userId);

        docs.sort((a, b) => (parseDateTime(b.created_at)?.getTime() || 0) - (parseDateTime(a.created_at)?.getTime() || 0));
        setNotifications(docs);

        if (initializedRef.current) {
          const addedUnread = snapshot
            .docChanges()
            .filter((change) => change.type === "added")
            .map((change) => ({
              id: change.doc.id,
              ...(change.doc.data() as Omit<FirebaseChatNotification, "id">),
            }))
            .find(
              (item) =>
                item.recipient_id === userId &&
                !item.is_read &&
                item.sender_id !== activePartnerId
            );

          if (addedUnread) {
            setLatestNotification(addedUnread);
          }
        }

        initializedRef.current = true;
      },
      () => {
        // Silent fail for Firebase listener issues
      }
    );

    return () => unsubscribe();
  }, [userId, activePartnerId]);

  const unreadBySender = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notifications) {
      if (!n.is_read) {
        counts[n.sender_id] = (counts[n.sender_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [notifications]);

  const markConversationRead = useCallback(
    async (senderId: string) => {
      if (!userId) return;

      const q = query(
        collection(db, "chat_notifications"),
        where("recipient_id", "==", userId),
        where("sender_id", "==", senderId),
        where("is_read", "==", false)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { is_read: true });
      });
      await batch.commit();
    },
    [userId]
  );

  const clearLatest = useCallback(() => setLatestNotification(null), []);

  return {
    notifications,
    unreadBySender,
    latestNotification,
    clearLatest,
    markConversationRead,
  };
}
