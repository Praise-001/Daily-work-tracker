"use client";
import { useState } from "react";
import emailjs from "@emailjs/browser";
import { createEntry } from "../lib/firestoreService";
import { sanitizeText } from "../lib/utils";
import type { Job } from "../lib/types";

export default function LogTeamSessionModal({ job, workerUid, workerName, onClose, adminEmail, teamName }: {
  job: Job;
  workerUid: string;
  workerName: string;
  onClose: () => void;
  adminEmail?: string;
  teamName?: string;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hrs = parseFloat(hours);
    if (isNaN(hrs) || hrs <= 0) { setError("Enter valid hours."); return; }
    setError("");
    setSaving(true);
    try {
      const entryData: Parameters<typeof createEntry>[0] = {
        jobId: job.id,
        teamId: job.teamId!,
        date,
        hours: hrs,
        status: "pending",
        workerUid,
        workerName,
      };
      if (note.trim()) entryData.note = sanitizeText(note, 300);
      await createEntry(entryData);

      // Fire-and-forget email — silently skipped if env vars not set
      const svc = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const tpl = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      const key = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
      if (adminEmail && svc && tpl && key) {
        emailjs.send(svc, tpl, {
          to_email: adminEmail,
          worker_name: workerName,
          job_name: job.name,
          team_name: teamName ?? job.name,
          hours: hrs.toString(),
          session_date: date,
          note: note.trim() || "—",
        }, key).catch(() => {});
      }

      setSuccess(true);
      setTimeout(onClose, 1400);
    } catch {
      setError("Failed to log session. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
      <div style={{ width: "100%", background: "var(--surface)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", padding: "24px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 400 }}>Log Session</h3>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{job.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error && <div className="message message-error" style={{ marginTop: 12 }}>{error}</div>}
        {success && (
          <div className="message" style={{ marginTop: 12, background: "rgba(61,186,126,0.12)", border: "1px solid rgba(61,186,126,0.25)", color: "#3dba7e" }}>
            Session submitted for approval!
          </div>
        )}

        {!success && (
          <form className="form" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
            <div className="field"><label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field"><label>Hours Worked</label>
              <input type="number" placeholder="e.g. 4.5" value={hours} onChange={(e) => setHours(e.target.value)} min="0.001" step="0.001" required autoFocus />
            </div>
            <div className="field"><label>Note (optional)</label>
              <textarea placeholder="What did you work on?" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              Your rate will be set by the team admin when they approve this session.
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? "Submitting…" : "Submit for Approval"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
