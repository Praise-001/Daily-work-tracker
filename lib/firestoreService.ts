import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile, Job, Entry, Team } from "./types";
import { generateInviteCode } from "./utils";

/** Remove keys whose value is `undefined` before writing to Firestore. */
function clean<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

function normalizeCloudinaryUploadError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error("Unknown upload error.");
  return error;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<UserProfile, "uid">) };
}

export async function createUserProfile(
  uid: string,
  data: Omit<UserProfile, "uid" | "createdAt">
): Promise<void> {
  await setDoc(doc(db, "users", uid), { ...clean(data), createdAt: serverTimestamp() });
}

export async function updateUserProfile(
  uid: string,
  data: Partial<Omit<UserProfile, "uid">>
): Promise<void> {
  await updateDoc(doc(db, "users", uid), clean(data) as Record<string, unknown>);
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function createJob(
  data: Omit<Job, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "jobs"), {
    ...clean(data),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateJob(
  jobId: string,
  data: Partial<Omit<Job, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "jobs", jobId), clean(data) as Record<string, unknown>);
}

/** Subscribe to all jobs owned by a user (personal jobs). */
export function subscribeUserJobs(
  uid: string,
  onData: (jobs: Job[]) => void
): Unsubscribe {
  const q = query(collection(db, "jobs"), where("ownerUid", "==", uid));
  return onSnapshot(q, (snap) => {
    const jobs = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) }))
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    onData(jobs);
  });
}

/** Subscribe to all jobs belonging to a team. */
export function subscribeTeamJobs(
  teamId: string,
  onData: (jobs: Job[]) => void
): Unsubscribe {
  const q = query(collection(db, "jobs"), where("teamId", "==", teamId));
  return onSnapshot(q, (snap) => {
    const jobs = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Job, "id">) }))
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    onData(jobs);
  });
}

// ─── Entries ──────────────────────────────────────────────────────────────────

export async function uploadSessionProof(
  file: File,
  workerUid: string,
  onProgress?: (progressPct: number) => void
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error("Missing Cloudinary env vars: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.");
  }
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `session-proofs/${workerUid}`);

  return await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timeoutId = setTimeout(() => {
      xhr.abort();
      reject(new Error("Upload timed out after 30s. Check network or Cloudinary config."));
    }, 30_000);

    xhr.open("POST", uploadUrl);

    xhr.upload.onprogress = (evt) => {
      if (!onProgress || !evt.lengthComputable || evt.total === 0) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress(pct);
    };

    xhr.onload = () => {
      clearTimeout(timeoutId);
      try {
        const payload = JSON.parse(xhr.responseText) as { secure_url?: string; error?: { message?: string } };
        if (xhr.status >= 200 && xhr.status < 300 && payload.secure_url) {
          resolve(payload.secure_url);
          return;
        }
        reject(new Error(payload.error?.message || `Cloudinary upload failed with status ${xhr.status}.`));
      } catch {
        reject(new Error("Cloudinary upload returned an invalid response."));
      }
    };

    xhr.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Network error while uploading image to Cloudinary."));
    };

    xhr.onabort = () => {
      clearTimeout(timeoutId);
      reject(new Error("Image upload was canceled."));
    };

    try {
      xhr.send(formData);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(normalizeCloudinaryUploadError(error));
    }
  });
}

export async function createEntry(
  data: Omit<Entry, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "entries"), {
    ...clean(data),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Subscribe to all entries logged by a specific user. */
export function subscribeUserEntries(
  uid: string,
  onData: (entries: Entry[]) => void
): Unsubscribe {
  const q = query(collection(db, "entries"), where("workerUid", "==", uid));
  return onSnapshot(q, (snap) => {
    const entries = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, "id">) }))
      .sort((a, b) => b.date.localeCompare(a.date));
    onData(entries);
  });
}

/** Subscribe to all entries for a specific job. */
export function subscribeJobEntries(
  jobId: string,
  onData: (entries: Entry[]) => void
): Unsubscribe {
  const q = query(collection(db, "entries"), where("jobId", "==", jobId));
  return onSnapshot(q, (snap) => {
    const entries = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, "id">) }))
      .sort((a, b) => b.date.localeCompare(a.date));
    onData(entries);
  });
}

/** Subscribe to all pending entries for jobs belonging to a team. */
export function subscribeTeamPendingEntries(
  teamId: string,
  onData: (entries: Entry[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "entries"),
    where("teamId", "==", teamId),
    where("status", "==", "pending")
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, "id">) }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    onData(entries);
  });
}

export async function updateEntry(
  entryId: string,
  data: Partial<Pick<Entry, "date" | "hours" | "rate" | "note" | "amount">>
): Promise<void> {
  await updateDoc(doc(db, "entries", entryId), clean(data));
}

export async function deleteEntry(entryId: string): Promise<void> {
  await deleteDoc(doc(db, "entries", entryId));
}

export async function approveEntry(entryId: string, amount: number, rate: number): Promise<void> {
  await updateDoc(doc(db, "entries", entryId), { status: "approved", amount, rate });
}

export async function rejectEntry(entryId: string): Promise<void> {
  await updateDoc(doc(db, "entries", entryId), { status: "rejected" });
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function createTeam(
  adminUid: string,
  teamName: string
): Promise<{ teamId: string; inviteCode: string }> {
  const inviteCode = generateInviteCode(8);
  const ref = await addDoc(collection(db, "teams"), {
    name: teamName,
    adminUid,
    inviteCode,
    members: {},
    createdAt: serverTimestamp(),
  });
  return { teamId: ref.id, inviteCode };
}

export async function getTeamByInviteCode(code: string): Promise<Team | null> {
  const q = query(collection(db, "teams"), where("inviteCode", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Team, "id">) };
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const snap = await getDoc(doc(db, "teams", teamId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Team, "id">) };
}

export async function joinTeam(
  teamId: string,
  uid: string,
  name: string
): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    [`members.${uid}`]: { name, joinedAt: serverTimestamp() },
  });
  // Also update the user's joinedTeams array
  const userSnap = await getDoc(doc(db, "users", uid));
  if (userSnap.exists()) {
    const data = userSnap.data() as UserProfile;
    const joined = data.joinedTeams ?? [];
    if (!joined.includes(teamId)) {
      await updateDoc(doc(db, "users", uid), {
        joinedTeams: [...joined, teamId],
      });
    }
  }
}

export function subscribeTeam(
  teamId: string,
  onData: (team: Team | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "teams", teamId), (snap) => {
    if (!snap.exists()) { onData(null); return; }
    onData({ id: snap.id, ...(snap.data() as Omit<Team, "id">) });
  });
}

export async function removeMember(teamId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    [`members.${uid}`]: deleteField(),
  });
  const userSnap = await getDoc(doc(db, "users", uid));
  if (userSnap.exists()) {
    const data = userSnap.data() as UserProfile;
    const joined = (data.joinedTeams ?? []).filter((tid) => tid !== teamId);
    await updateDoc(doc(db, "users", uid), { joinedTeams: joined });
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  await deleteDoc(doc(db, "jobs", jobId));
}

/** Subscribe to a single job document. */
export function subscribeJob(
  jobId: string,
  onData: (job: Job | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "jobs", jobId), (snap) => {
    if (!snap.exists()) { onData(null); return; }
    onData({ id: snap.id, ...(snap.data() as Omit<Job, "id">) });
  });
}

/** Subscribe to ALL entries for a team (all statuses) — for admin analytics. */
export function subscribeAllTeamEntries(
  teamId: string,
  onData: (entries: Entry[]) => void
): Unsubscribe {
  const q = query(collection(db, "entries"), where("teamId", "==", teamId));
  return onSnapshot(q, (snap) => {
    const entries = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Entry, "id">) }))
      .sort((a, b) => b.date.localeCompare(a.date));
    onData(entries);
  });
}
