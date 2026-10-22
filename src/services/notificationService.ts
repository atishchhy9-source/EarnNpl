import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { NotificationItem } from '../types';

export async function fetchUserNotifications(userId: string): Promise<NotificationItem[]> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      limit(30)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => d.data() as NotificationItem);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'notifications');
  }
}

export async function markNotificationAsRead(notifId: string): Promise<void> {
  try {
    const ref = doc(db, 'notifications', notifId);
    await updateDoc(ref, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notifId}`);
  }
}
