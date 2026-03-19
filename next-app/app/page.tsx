"use client";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";
import { auth, db, provider } from "../lib/firebase";
import NavBar from "../components/NavBar";
import { JobCard } from "../components/JobCard";
import { SessionList } from "../components/SessionList";

type Job = { id: string; name: string; cur: string; defRate?: number };
type Entry = {
  id: string;
  jobId: string;
  date: string;
  hours: number;
  rate: number;
  note?: string;
  status?: string;
};

export default function Home() {
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUserEmail(u.email || u.uid);
      } else {
        setUserEmail(undefined);
        setJobs([]);
        setEntries([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Live Firestore stream
  useEffect(() => {
    if (!userEmail) return;
    const jobsRef = collection(db, "jobs");
    const entriesRef = collection(db, "entries");
    const unsubJobs = onSnapshot(jobsRef, (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    const unsubEntries = onSnapshot(query(entriesRef, orderBy("date", "desc")), (snap) => {
      setEntries(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      );
    });
    return () => {
      unsubJobs();
      unsubEntries();
    };
  }, [userEmail]);

  const totals = useMemo(() => {
    const earned = entries.reduce((s, e) => s + (e.hours || 0) * (e.rate || 0), 0);
    const hours = entries.reduce((s, e) => s + (e.hours || 0), 0);
    return { earned, hours, sessions: entries.length };
  }, [entries]);

  const entriesWithJob = useMemo(() => {
    const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));
    return entries.map((e) => ({
      ...e,
      jobName: byId[e.jobId]?.name || "Job",
    }));
  }, [entries, jobs]);

  return (
    <>
      <NavBar userEmail={userEmail} onSignOut={() => { setJobs([]); setEntries([]); }} />

      {!userEmail && (
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <h1 style={{ fontFamily: "Playfair Display, serif" }}>Work Journal</h1>
          <p className="muted">Log hours, track earnings, and approve your crew from any device.</p>
          <div style={{ marginTop: 18 }}>
            <button
              className="btn btn-primary"
              onClick={() => signInWithPopup(auth, provider)}
            >
              Sign in with Google
            </button>
          </div>
        </div>
      )}

      {userEmail && (
        <>
          <div className="hero" style={{ marginTop: 22 }}>
            <div className="card">
              <h3>Live balance</h3>
              <div className="stat">
                <div>
                  <strong>${totals.earned.toFixed(2)}</strong>
                  <span className="muted">Earned</span>
                </div>
                <div>
                  <strong>{totals.hours.toFixed(1)}h</strong>
                  <span className="muted">Hours</span>
                </div>
                <div>
                  <strong>{totals.sessions}</strong>
                  <span className="muted">Sessions</span>
                </div>
              </div>
              <div className="muted" style={{ marginTop: 10 }}>
                Data is streamed from Firestore in real time. No data is cached locally.
              </div>
            </div>
            <div className="card">
              <h3>Quick actions</h3>
              <div className="toolbar">
                <button className="btn btn-primary">Log session</button>
                <button className="btn btn-ghost">Add job</button>
              </div>
              <div className="muted" style={{ marginTop: 10 }}>
                Approvals and edits are restricted to admins via Firestore rules.
              </div>
            </div>
          </div>

          <div className="grid">
            {jobs.map((j) => {
              const jobEntries = entries.filter((e) => e.jobId === j.id);
              const earned = jobEntries.reduce((s, e) => s + (e.hours || 0) * (e.rate || 0), 0);
              const hours = jobEntries.reduce((s, e) => s + (e.hours || 0), 0);
              return (
                <JobCard
                  key={j.id}
                  title={j.name}
                  currency={j.cur || "$"}
                  earned={earned}
                  hours={hours}
                  sessions={jobEntries.length}
                />
              );
            })}
          </div>

          <div style={{ marginTop: 26 }}>
            <h3 style={{ fontFamily: "Playfair Display, serif" }}>Recent sessions</h3>
            <SessionList entries={entriesWithJob.slice(0, 12)} />
          </div>
        </>
      )}

      {loading && <div className="muted" style={{ marginTop: 16 }}>Loading…</div>}
    </>
  );
}
