"use client";
import { useEffect, useState } from "react";
import type { Job } from "../lib/types";
import { updateJob, createEntry, deleteJob } from "../lib/firestoreService";
import { getCurrencyByCode } from "../lib/currencies";
import { sanitizeText } from "../lib/utils";
import CurrencyPicker from "./CurrencyPicker";
import RateTypeToggle from "./RateTypeToggle";
import type { RateType } from "../lib/types";

interface Props {
  job: Job | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (jobId: string) => void;
  workerUid: string;
  workerName: string;
}

type PanelView = "log" | "edit";

export default function JobDetailPanel({ job, open, onClose, onDelete, workerUid, workerName }: Props) {
  const [view, setView] = useState<PanelView>("log");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Log session form
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [logHours, setLogHours] = useState("");
  const [logRate, setLogRate] = useState("");
  const [logNote, setLogNote] = useState("");

  // Edit job form
  const [editName, setEditName] = useState("");
  const [editCur, setEditCur] = useState("USD");
  const [editRateType, setEditRateType] = useState<RateType>("hour");
  const [editRate, setEditRate] = useState("");

  useEffect(() => {
    if (!job) return;
    setEditName(job.name);
    setEditCur(job.cur);
    setEditRateType(job.rateType);
    setEditRate(job.defRate?.toString() ?? "");
    setView("log");
    setError("");
    setSuccess(false);
    setConfirmDelete(false);
  }, [job]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function handleLogSession(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    const hours = parseFloat(logHours);
    if (isNaN(hours) || hours <= 0) { setError("Enter valid hours."); return; }
    setError("");
    setSaving(true);
    try {
      const rateVal = logRate ? parseFloat(logRate) : (job.defRate ?? 0);
      const entryData: Parameters<typeof createEntry>[0] = {
        jobId: job.id,
        date: logDate,
        hours,
        rate: rateVal,
        amount: hours * rateVal,
        status: "approved",
        workerUid,
        workerName,
      };
      if (logNote.trim()) entryData.note = sanitizeText(logNote, 300);
      await createEntry(entryData);
      setLogHours("");
      setLogRate("");
      setLogNote("");
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1200);
    } catch {
      setError("Failed to save session. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveJob(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    if (!editName.trim()) { setError("Job name required."); return; }
    setError("");
    setSaving(true);
    try {
      const cur = getCurrencyByCode(editCur);
      const updateData: Parameters<typeof updateJob>[1] = {
        name: sanitizeText(editName, 60),
        cur: cur.code,
        curSymbol: cur.symbol,
        rateType: editRateType,
      };
      if (editRate) updateData.defRate = parseFloat(editRate);
      await updateJob(job.id, updateData);
      setView("log");
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!job) return;
    setDeleting(true);
    try {
      await deleteJob(job.id);
      onDelete?.(job.id);
      onClose();
    } catch {
      setError("Failed to delete job. Try again.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (!job) return null;
  const currency = getCurrencyByCode(job.cur);

  return (
    <>
      <div className={`job-panel-overlay${open ? " open" : ""}`} onClick={onClose} />
      <div className={`job-panel${open ? " open" : ""}`} role="dialog" aria-label={job.name}>
        <div className="job-panel-handle" />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div className="job-panel-title">{job.name}</div>
            <div className="job-panel-sub">
              {currency.symbol} · {job.rateType === "hour" ? "Per hour" : "Per day"}
              {job.defRate ? ` · ${currency.symbol}${job.defRate} default` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, marginTop: 4 }}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
          {(["log", "edit"] as PanelView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setView(v); setError(""); setSuccess(false); setConfirmDelete(false); }}
              className={`dash-tab${view === v ? " active" : ""}`}
            >
              {v === "log" ? "Log Session" : "Edit Job"}
            </button>
          ))}
        </div>

        {error && <div className="message message-error">{error}</div>}
        {success && (
          <div className="message" style={{ background: "var(--green-dim, rgba(61,186,126,0.12))", border: "1px solid rgba(61,186,126,0.25)", color: "var(--green, #3dba7e)" }}>
            Session logged!
          </div>
        )}

        {/* Log session */}
        {view === "log" && (
          <form className="form" onSubmit={handleLogSession}>
            <div className="field">
              <label>Date</label>
              <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Hours Worked</label>
              <input
                type="number"
                placeholder="e.g. 4.5"
                value={logHours}
                onChange={(e) => setLogHours(e.target.value)}
                min="0.1"
                step="0.1"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label>
                Rate ({currency.symbol}/{job.rateType})
                {job.defRate ? ` — default: ${currency.symbol}${job.defRate}` : ""}
              </label>
              <input
                type="number"
                placeholder={job.defRate ? `${job.defRate}` : `${currency.symbol} per ${job.rateType}`}
                value={logRate}
                onChange={(e) => setLogRate(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="field">
              <label>Note (optional)</label>
              <textarea
                placeholder="What did you work on?"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                maxLength={300}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? "Saving…" : "Log Session"}
            </button>
          </form>
        )}

        {/* Edit job */}
        {view === "edit" && (
          <form className="form" onSubmit={handleSaveJob}>
            <div className="field">
              <label>Job Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={60}
                required
              />
            </div>
            <div className="field">
              <label>Currency</label>
              <CurrencyPicker value={editCur} onChange={setEditCur} />
            </div>
            <div className="field">
              <label>Pay Rate</label>
              <RateTypeToggle value={editRateType} onChange={setEditRateType} />
            </div>
            <div className="field">
              <label>Default Rate (optional)</label>
              <input
                type="number"
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>

            {/* Delete section */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              {!confirmDelete ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ width: "100%", color: "#e05454" }}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete Job
                </button>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                    Delete &ldquo;{job.name}&rdquo;? This can&apos;t be undone.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ flex: 1 }}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1, background: "#e05454", borderColor: "#e05454" }}
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </>
  );
}
