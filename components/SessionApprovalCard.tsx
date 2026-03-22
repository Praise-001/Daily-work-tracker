"use client";
import { useState } from "react";
import type { Entry, Job } from "../lib/types";
import { approveEntry, rejectEntry } from "../lib/firestoreService";
import { formatDate } from "../lib/utils";

interface Props {
  entry: Entry;
  job: Job | undefined;
}

export default function SessionApprovalCard({ entry, job }: Props) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rateInput, setRateInput] = useState(job?.defRate?.toString() ?? "");
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const { day, date } = formatDate(entry.date);
  const currency = job ? { symbol: job.curSymbol, code: job.cur } : { symbol: "", code: "" };

  async function handleApprove() {
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate < 0) { setError("Enter a valid rate."); return; }
    setError("");
    setApproving(true);
    try {
      const amount = entry.hours * rate;
      await approveEntry(entry.id, amount, rate);
      setDone(true);
    } catch {
      setError("Failed to approve. Try again.");
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    try {
      await rejectEntry(entry.id);
      setDone(true);
    } catch {
      setError("Failed to reject. Try again.");
    } finally {
      setRejecting(false);
    }
  }

  if (done) return null;

  return (
    <div className="approval-card">
      <div className="approval-card-top">
        <div>
          <div className="approval-worker">{entry.workerName ?? "Team Member"}</div>
          <div className="approval-meta">
            {day} {date} · {entry.hours}h · {job?.name ?? "Unknown job"}
          </div>
        </div>
        <span className="status-badge pending">Pending</span>
      </div>

      {entry.note && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8, fontStyle: "italic" }}>
          &ldquo;{entry.note}&rdquo;
        </div>
      )}

      {error && <div className="message message-error" style={{ marginBottom: 8 }}>{error}</div>}

      {showApproveForm ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
            Set rate ({currency.symbol}/{job?.rateType ?? "hr"}) to approve:
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              className="form"
              style={{ flex: 1, padding: "8px 12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 15, color: "var(--text)", fontFamily: "inherit" }}
              placeholder={`Rate per ${job?.rateType ?? "hr"}`}
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              min="0"
              step="0.01"
              autoFocus
            />
            <button
              className="btn-approve"
              onClick={handleApprove}
              disabled={approving}
              type="button"
            >
              {approving ? "…" : `Approve (${currency.symbol}${(parseFloat(rateInput) || 0) * entry.hours})`}
            </button>
          </div>
        </div>
      ) : (
        <div className="approval-actions">
          <button className="btn-approve" type="button" onClick={() => setShowApproveForm(true)}>
            Approve
          </button>
          <button className="btn-reject" type="button" onClick={handleReject} disabled={rejecting}>
            {rejecting ? "…" : "Reject"}
          </button>
        </div>
      )}
    </div>
  );
}
