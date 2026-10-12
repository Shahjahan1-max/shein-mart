import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let projectId = process.env.FIREBASE_PROJECT_ID;
let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
let storageBucketName = process.env.FIREBASE_STORAGE_BUCKET;

// Auto-detect service account JSON file if env vars are missing or key is broken
// Looks for any .json file in app root that contains "private_key"
function tryLoadServiceAccountJson() {
  const searchDirs = [
    __dirname,
    path.join(__dirname, ".."),
    process.cwd(),
  ];
  for (const dir of searchDirs) {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith(".json") && !f.includes("package") && !f.includes("tsconfig"));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(dir, file), "utf8");
          const json = JSON.parse(content);
          if (json.type === "service_account" && json.private_key && json.client_email) {
            console.log(`[db] Loaded service account from: ${file}`);
            return json;
          }
        } catch {}
      }
    } catch {}
  }
  return null;
}

// If private key is missing or unparseable, try JSON file fallback
if (!privateKey || !privateKey.includes("-----BEGIN")) {
  const sa = tryLoadServiceAccountJson();
  if (sa) {
    projectId = projectId || sa.project_id;
    clientEmail = clientEmail || sa.client_email;
    privateKey = normalizePrivateKey(sa.private_key);
    storageBucketName = storageBucketName || `${sa.project_id}.appspot.com`;
    console.log("[db] Using service account JSON file for Firebase credentials.");
  }
}

let firebaseApp = null;
let firestoreDb = null;
let firebaseBucket = null;
let firebaseAuth = null;
let firebaseInitError = "";

function normalizePrivateKey(value) {
  if (!value) return "";

  let key = String(value).trim();

  // Strip surrounding quotes (single or double) — dotenv on Linux keeps them
  key = key.replace(/^["']|["']$/g, "").trim();

  // If key looks like base64 (no PEM header), try to decode it first
  if (!key.includes("-----BEGIN")) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf8");
      if (decoded.includes("-----BEGIN")) {
        key = decoded.trim();
      }
    } catch {
      // not base64, continue with original
    }
  }

  // Replace ALL forms of escaped newlines with actual newlines
  // This handles: \n (literal backslash-n), \\n (double escaped), \r\n
  key = key
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Ensure header and footer are on their own lines
  key = key
    .replace(/(-----BEGIN [^-]+-----)\s*/g, "$1\n")
    .replace(/\s*(-----END [^-]+-----)/g, "\n$1");

  // Remove extra blank lines, trim
  key = key.replace(/\n{3,}/g, "\n").trim();

  return key;
}

if (projectId && clientEmail && privateKey) {
  try {
    firebaseApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          ...(storageBucketName ? { storageBucket: storageBucketName } : {}),
        });
    firestoreDb = admin.firestore(firebaseApp);
    firebaseAuth = admin.auth(firebaseApp);
    if (storageBucketName) {
      firebaseBucket = admin.storage(firebaseApp).bucket(storageBucketName);
    }
    console.log(`Firebase initialized: project=${projectId}, auth=${Boolean(firebaseAuth)}, storage=${Boolean(firebaseBucket)}`);
  } catch (error) {
    firebaseInitError = error?.message || "Firebase initialization failed.";
    console.error("Firebase initialization failed:", firebaseInitError);
    console.error("Private key first 40 chars:", privateKey?.slice(0, 40));
    console.error("Private key includes BEGIN:", privateKey?.includes("-----BEGIN"));
  }
} else {
  const missing = [
    !projectId && "FIREBASE_PROJECT_ID",
    !clientEmail && "FIREBASE_CLIENT_EMAIL",
    !privateKey && "FIREBASE_PRIVATE_KEY",
  ].filter(Boolean);
  firebaseInitError = `Missing Firebase env vars: ${missing.join(", ")}`;
  console.error(firebaseInitError);
}

export const firebase = firebaseApp;
export const db = firestoreDb;
export const bucket = firebaseBucket;
export const auth = firebaseAuth;
export default firestoreDb;

export function firebaseEnabled() {
  return Boolean(firestoreDb);
}

export function firebaseStorageEnabled() {
  return Boolean(firebaseBucket);
}

export function firebaseAuthEnabled() {
  return Boolean(firebaseAuth);
}

export function getFirebaseInitStatus() {
  return {
    ok: Boolean(firestoreDb),
    projectId: projectId || "",
    clientEmail: clientEmail || "",
    storageBucketName: storageBucketName || "",
    hasPrivateKey: Boolean(privateKey),
    error: firebaseInitError || null,
  };
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefined(item)])
  );
}

function docIdFromItem(item, fallbackPrefix = "doc") {
  return String(item?.id || item?.sessionId || item?.userId || `${fallbackPrefix}-${Date.now()}`).trim();
}

export async function testFirebaseConnection() {
  if (!firestoreDb) {
    return {
      ok: false,
      error: firebaseInitError || "Firebase is not initialized. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    };
  }

  try {
    const snapshot = await firestoreDb.collection("users").limit(1).get();
    return {
      ok: true,
      projectId,
      data: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })),
    };
  } catch (error) {
    return { ok: false, error: error?.message || "Unknown Firebase error." };
  }
}

export async function listFirebaseCollection(collectionName) {
  if (!firestoreDb) return { ok: false, data: [], error: "Firebase is not initialized." };
  try {
    const snapshot = await firestoreDb.collection(collectionName).get();
    return {
      ok: true,
      data: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })),
    };
  } catch (error) {
    return { ok: false, data: [], error: error?.message || "Failed to read Firebase collection." };
  }
}

export async function listFirebaseCollectionFiltered(collectionName, where = []) {
  if (!firestoreDb) return { ok: false, data: [], error: "Firebase is not initialized." };
  try {
    let query = firestoreDb.collection(collectionName);
    for (const [field, op, value] of where) {
      query = query.where(field, op, value);
    }
    const snapshot = await query.get();
    return {
      ok: true,
      data: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })),
    };
  } catch (error) {
    return { ok: false, data: [], error: error?.message || "Failed to query Firebase collection." };
  }
}

/**
 * Count documents using Firestore aggregation so badge-style UI does not need
 * to read whole collections.
 * @param {string} collectionName
 * @param {{ where?: Array<[string,string,unknown]> }} opts
 */
export async function countFirebaseCollection(collectionName, opts = {}) {
  if (!firestoreDb) return { ok: false, count: 0, error: "Firebase is not initialized." };
  try {
    let q = firestoreDb.collection(collectionName);
    if (Array.isArray(opts.where)) {
      for (const [field, op, val] of opts.where) {
        q = q.where(field, op, val);
      }
    }
    const snapshot = await q.count().get();
    return { ok: true, count: snapshot.data().count || 0 };
  } catch (error) {
    return { ok: false, count: 0, error: error?.message || "Failed to count Firebase collection." };
  }
}

/**
 * Paginated collection read using Firestore cursors.
 * @param {string} collectionName
 * @param {{ limit?: number, orderField?: string, orderDir?: 'asc'|'desc', afterDocId?: string, where?: Array<[string,string,unknown]> }} opts
 */
export async function listFirebaseCollectionPaginated(collectionName, opts = {}) {
  if (!firestoreDb) return { ok: false, data: [], hasMore: false, nextCursor: null, error: "Firebase is not initialized." };
  try {
    const pageSize = Math.min(Number(opts.limit) || 25, 200);
    const orderField = opts.orderField || "createdAt";
    const orderDir   = opts.orderDir   || "desc";

    let q = firestoreDb.collection(collectionName).orderBy(orderField, orderDir);

    // Apply where filters
    if (Array.isArray(opts.where)) {
      for (const [field, op, val] of opts.where) {
        q = q.where(field, op, val);
      }
    }

    // Apply cursor
    if (opts.afterDocId) {
      try {
        const cursorDoc = await firestoreDb.collection(collectionName).doc(String(opts.afterDocId)).get();
        if (cursorDoc.exists) q = q.startAfter(cursorDoc);
      } catch { /* cursor doc missing — start from beginning */ }
    }

    // Fetch one extra to detect hasMore
    const snapshot = await q.limit(pageSize + 1).get();
    const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    const hasMore = docs.length > pageSize;
    const data = hasMore ? docs.slice(0, pageSize) : docs;
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

    return { ok: true, data, hasMore, nextCursor };
  } catch (error) {
    return { ok: false, data: [], hasMore: false, nextCursor: null, error: error?.message || "Failed to read Firebase collection." };
  }
}

export async function getFirebaseDoc(collectionName, id) {
  if (!firestoreDb || !id) return { ok: false, data: null, error: "Firebase is not initialized or id is missing." };
  try {
    const doc = await firestoreDb.collection(collectionName).doc(String(id)).get();
    return doc.exists
      ? { ok: true, data: { ...doc.data(), id: doc.id } }
      : { ok: false, data: null, error: "Document not found." };
  } catch (error) {
    return { ok: false, data: null, error: error?.message || "Failed to read Firebase document." };
  }
}

export async function saveFirebaseDoc(collectionName, id, data) {
  if (!firestoreDb || !id) return { ok: false, error: "Firebase is not initialized or id is missing." };
  try {
    const payload = stripUndefined({
      ...data,
      id: String(id),
      updatedAt: data?.updatedAt || new Date().toISOString(),
      createdAt: data?.createdAt || new Date().toISOString(),
    });
    await firestoreDb.collection(collectionName).doc(String(id)).set(payload, { merge: true });
    return { ok: true, data: { id: String(id), ...payload } };
  } catch (error) {
    return { ok: false, error: error?.message || "Failed to save Firebase document." };
  }
}

export async function deleteFirebaseDoc(collectionName, id) {
  if (!firestoreDb || !id) return { ok: false, error: "Firebase is not initialized or id is missing." };
  try {
    await firestoreDb.collection(collectionName).doc(String(id)).delete();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "Failed to delete Firebase document." };
  }
}

export async function saveFirebaseArray(collectionName, items, fallbackPrefix = "doc") {
  if (!firestoreDb) return { ok: false, error: "Firebase is not initialized." };
  try {
    const batch = firestoreDb.batch();
    for (const item of items) {
      const id = docIdFromItem(item, fallbackPrefix);
      if (!id) continue;
      batch.set(
        firestoreDb.collection(collectionName).doc(id),
        stripUndefined({
          ...item,
          id,
          updatedAt: item?.updatedAt || new Date().toISOString(),
          createdAt: item?.createdAt || new Date().toISOString(),
        }),
        { merge: true },
      );
    }
    await batch.commit();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "Failed to save Firebase collection." };
  }
}

export async function saveFirebaseMap(collectionName, map) {
  const items = Object.entries(map || {}).map(([id, value]) => ({ id, ...(value && typeof value === "object" ? value : { value }) }));
  return saveFirebaseArray(collectionName, items, collectionName);
}

function getStorageBucketCandidates() {
  const candidates = [
    storageBucketName,
    projectId ? `${projectId}.appspot.com` : "",
    projectId ? `${projectId}.firebasestorage.app` : "",
  ].filter(Boolean);
  return [...new Set(candidates.map(item => String(item).trim()).filter(Boolean))];
}

export async function uploadFirebaseAsset({ path, buffer, contentType }) {
  if (!firebaseApp && !firebaseBucket) return { ok: false, error: "Firebase Storage is not initialized. Set FIREBASE_STORAGE_BUCKET." };
  if (!path || !buffer) return { ok: false, error: "Storage path or file buffer is missing." };
  let lastError = null;
  for (const bucketName of getStorageBucketCandidates()) {
    try {
      const bucket = bucketName === storageBucketName && firebaseBucket
        ? firebaseBucket
        : admin.storage(firebaseApp).bucket(bucketName);
      const file = bucket.file(path);
      await file.save(buffer, {
        resumable: false,
        metadata: { contentType: contentType || "application/octet-stream" },
      });
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2500",
      });
      return { ok: true, url, path, bucket: bucketName };
    } catch (error) {
      lastError = error;
    }
  }
  return { ok: false, error: lastError?.message || "Failed to upload Firebase asset." };
}

export async function createFirebaseAuthUser({ uid, email, password, displayName, disabled = false }) {
  if (!firebaseAuth) return { ok: false, error: "Firebase Auth is not initialized." };
  try {
    const payload = {
      uid: uid ? String(uid) : undefined,
      email: String(email || "").trim(),
      password: String(password || ""),
      displayName: displayName ? String(displayName) : undefined,
      disabled,
    };
    const user = await firebaseAuth.createUser(payload);
    return { ok: true, data: user.toJSON() };
  } catch (error) {
    if (error?.code === "auth/uid-already-exists" || error?.code === "auth/email-already-exists") {
      try {
        const existing = error?.code === "auth/email-already-exists"
          ? await firebaseAuth.getUserByEmail(String(email || "").trim())
          : await firebaseAuth.getUser(String(uid || ""));
        return { ok: true, data: existing.toJSON(), alreadyExists: true };
      } catch (inner) {
        return { ok: false, error: inner?.message || error?.message || "Failed to fetch existing Firebase Auth user." };
      }
    }
    return { ok: false, error: error?.message || "Failed to create Firebase Auth user." };
  }
}

export async function updateFirebaseAuthUser(uid, data) {
  if (!firebaseAuth) return { ok: false, error: "Firebase Auth is not initialized." };
  if (!uid) return { ok: false, error: "Firebase Auth uid is missing." };
  try {
    const payload = {};
    if (data?.email) payload.email = String(data.email).trim();
    if (data?.password) payload.password = String(data.password);
    if (data?.displayName) payload.displayName = String(data.displayName);
    if (data?.photoURL) payload.photoURL = String(data.photoURL);
    if (typeof data?.disabled === "boolean") payload.disabled = data.disabled;
    const user = await firebaseAuth.updateUser(String(uid), payload);
    return { ok: true, data: user.toJSON() };
  } catch (error) {
    return { ok: false, error: error?.message || "Failed to update Firebase Auth user." };
  }
}

export async function getFirebaseAuthUserByEmail(email) {
  if (!firebaseAuth) return { ok: false, error: "Firebase Auth is not initialized." };
  try {
    const user = await firebaseAuth.getUserByEmail(String(email || "").trim());
    return { ok: true, data: user.toJSON() };
  } catch (error) {
    return { ok: false, error: error?.message || "Firebase Auth user not found." };
  }
}

export async function getAllUsersFromFirebase() {
  return listFirebaseCollection("users");
}

export async function saveUserToFirebase(user) {
  if (!user?.id) return { ok: false, error: "User id is missing." };
  const { passwordHash, passwordSalt, ...safeUser } = user;
  return saveFirebaseDoc("users", user.id, safeUser);
}
