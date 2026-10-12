import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBSMva2N9Uzx4Es3AAl0uwDIrr-M21o9qE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dealxstocks.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dealxstocks",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dealxstocks.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1019531835729",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1019531835729:web:626923a7987046c7203b70",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-0FD872KHH9",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://dealxstocks-default-rtdb.asia-southeast1.firebasedatabase.app",
};

export const firebaseApp: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

/**
 * Flag indicating active cloud subscription status.
 */
export const FIREBASE_SUBSCRIPTION_ACTIVE = true;

/**
 * Firestore instance with IndexedDB persistent local cache.
 */
let _db: Firestore | null = null;

export function getFirestoreDb(): Firestore {
  if (_db) return _db;

  if (getApps().length === 0) {
    throw new Error("[firebaseClient] Firebase app not initialized.");
  }

  try {
    _db = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("has already been started")) {
      _db = getFirestore(firebaseApp);
    } else {
      console.warn("[firebaseClient] Persistent cache unavailable, falling back to memory cache:", msg);
      _db = getFirestore(firebaseApp);
    }
  }

  return _db;
}

/**
 * Firebase Realtime Database (RTDB) instance for ultra-fast instant live messaging.
 */
let _rtdb: Database | null = null;

export function getRealtimeDb(): Database {
  if (_rtdb) return _rtdb;
  _rtdb = getDatabase(firebaseApp, firebaseConfig.databaseURL);
  return _rtdb;
}

export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (!firebaseConfig.measurementId || typeof window === "undefined") return null;
  try {
    return (await isSupported()) ? getAnalytics(firebaseApp) : null;
  } catch {
    return null;
  }
}

export { firebaseConfig };
