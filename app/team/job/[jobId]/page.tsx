"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import AuthGuard from "../../../../components/AuthGuard";
import CurrencyPicker from "../../../../components/CurrencyPicker";
import { useAuth } from "../../../../lib/AuthContext";
import {
  subscribeJob,
  subscribeJobEntries,
  subscribeTeam,
  updateJob,
  removeMember,
} from "../../../../lib/firestoreService";
import { getCurrencyByCode } from "../../../../lib/currencies";
import { formatDate, formatAmount, sanitizeText } from "../../../../lib/utils";
import type { Job, Entry, Team } from "../../../../lib/types";

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function TeamJobDetailInner() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId ?? "";
  const { userProfile } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit job state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCur, setEditCur] = useState("NGN");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Remove member state
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Redirect non-team users
  useEffect(() => {
    if (userProfile && userProfile.type !== "team") {
      router.replace("/dashboard");
    }
  }, [userProfile, router]);

  useEffect(() => {
    if (!jobId) return;
    let jobLoaded = false;
    const unsubJob = subscribeJob(jobId, (j) => {
      setJob(j);
      if (!jobLoaded) { jobLoaded = true; setLoading(false); }
    });
    const unsubEntries = subscribeJobEntries(jobId, setEntries);
    return () => { unsubJob(); unsubEntries(); };
  }, [jobId]);

  // Subscribe to team once job.teamId is known
  useEffect(() => {
    if (!job?.teamId) return;
    const unsub = subscribeTeam(job.teamId, setTeam);
    return unsub;
  }, [job?.teamId]);

  // Sync edit form with live job data
  useEffect(() => {
    if (job && !editOpen) {
      setEditName(job.name);
      setEditCur(job.cur);
    }
  }, [job, editOpen]);

  function openEdit() {
    if (!job) return;
    setEditName(job.name);
    setEditCur(job.cur);
    setSaveError("");
    setEditOpen(true);
  }

  async function handleSave() {
    if (!job || !editName.trim()) { setSaveError("Name required."); return; }
    setSaving(true);
    setSaveError("");
    try {
      const currency = getCurrencyByCode(editCur);
      await updateJob(job.id, {
        name: sanitizeText(editName, 60),
        cur: currency.code,
        curSymbol: currency.symbol,
      });
      setEditOpen(false);
    } catch {
      setSaveError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveMember(uid: string) {
    if (!job?.teamId) return;
    setRemoving(true);
    try {
      await removeMember(job.teamId, uid);
      setRemovingUid(null);
    } catch {
      // silently reset — subscription will not update if it failed
    } finally {
      setRemoving(false);
    }
  }

  // Per-worker stats keyed by uid (derived from entries)
  const workerStats = useMemo(() => {
    const map: Record<string, { totalHours: number; approvedAmount: number; pendingHours: number }> = {};
    for (const e of entries) {
      if (!map[e.workerUid]) {
        map[e.workerUid] = { totalHours: 0, approvedAmount: 0, pendingHours: 0 };
      }
      map[e.workerUid].totalHours += e.hours;
      if (e.status === "approved" && e.amount != null) {
        map[e.workerUid].approvedAmount += e.amount;
      } else {
        map[e.workerUid].pendingHours += e.hours;
      }
    }
    return map;
  }, [entries]);

  const currency = job ? getCurrencyByCode(job.cur) : null;
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalEarned = entries
    .filter((e) => e.status === "approved" && e.amount != null)
    .reduce((s, e) => s + (e.amount ?? 0), 0);
  const pendingCount = entries.filter((e) => e.status === "pending").length;

  const teamMembers = Object.entries(team?.members ?? {});

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  if (!job) {
    return (
      <div className="dash-shell">
        <div className="page-content" style={{ paddingTop: 40, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>Job not found.</p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => router.replace("/team")}>
            Back to team
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-shell">
      {/* Top bar */}
      <div className="top-bar">
        <button
          onClick={() => router.replace("/team")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 14, padding: "4px 0" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Team
        </button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--serif)", fontSize: 17, fontWeight: 400 }}>
          {job.name}
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div className="dash-content">
        <div className="page-content">

          {/* Job summary card */}
          <div className="card" style={{ padding: "16px 20px", marginBottom: 24 }}>
            {/* Header row with edit button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 400 }}>{job.name}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  {currency?.symbol} · {job.rateType === "hour" ? "Per hour" : "Per day"}
                  {job.defRate ? ` · ${currency?.symbol}${job.defRate} default` : ""}
                </div>
              </div>
              <button
                onClick={openEdit}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 10px", cursor: "pointer", color: "var(--muted)", fontSize: 12 }}
              >
                <PencilIcon /> Edit
              </button>
            </div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{+totalHours.toFixed(3)}h</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Total hours</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{currency?.symbol}{formatAmount(totalEarned)}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Earned</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{pendingCount}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Pending</div>
              </div>
            </div>

            {/* Inline edit form */}
            {editOpen && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 12, textTransform: "uppercase" }}>
                  Edit Job
                </div>
                {saveError && <div className="message message-error" style={{ marginBottom: 10 }}>{saveError}</div>}
                <div className="field" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12 }}>Job Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={60}
                    autoFocus
                  />
                </div>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12 }}>Currency</label>
                  <CurrencyPicker value={editCur} onChange={setEditCur} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ flex: 1 }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="btn"
                    onClick={() => { setEditOpen(false); setSaveError(""); }}
                    style={{ flex: 1, background: "var(--surface2)", color: "var(--muted)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Members — always shown, all team members */}
          {teamMembers.length > 0 && (
            <>
              <div className="section-header" style={{ marginBottom: 12 }}>
                <h3>Members</h3>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {teamMembers
                  .sort((a, b) => (workerStats[b[0]]?.totalHours ?? 0) - (workerStats[a[0]]?.totalHours ?? 0))
                  .map(([uid, member]) => {
                    const stats = workerStats[uid] ?? { totalHours: 0, approvedAmount: 0, pendingHours: 0 };
                    const isConfirming = removingUid === uid;
                    return (
                      <div key={uid} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="member-avatar" style={{ width: 40, height: 40, fontSize: 16, flexShrink: 0 }}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{member.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {stats.totalHours > 0
                              ? `${+stats.totalHours.toFixed(3)}h logged${stats.pendingHours > 0 ? ` · ${+stats.pendingHours.toFixed(3)}h pending` : ""}`
                              : "No sessions yet"}
                          </div>
                        </div>

                        {/* Earnings / confirmation */}
                        {isConfirming ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>Remove?</span>
                            <button
                              onClick={() => handleRemoveMember(uid)}
                              disabled={removing}
                              style={{ fontSize: 12, fontWeight: 600, color: "#e55", background: "none", border: "1px solid #e55", borderRadius: "var(--radius)", padding: "3px 10px", cursor: "pointer" }}
                            >
                              {removing ? "…" : "Confirm"}
                            </button>
                            <button
                              onClick={() => setRemovingUid(null)}
                              style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                            <div style={{ textAlign: "right" }}>
                              {stats.approvedAmount > 0 ? (
                                <div style={{ fontSize: 16, fontWeight: 600 }}>
                                  {currency?.symbol}{formatAmount(stats.approvedAmount)}
                                </div>
                              ) : stats.pendingHours > 0 ? (
                                <span className="status-badge pending">Pending</span>
                              ) : (
                                <span style={{ fontSize: 13, color: "var(--muted)" }}>—</span>
                              )}
                            </div>
                            <button
                              onClick={() => setRemovingUid(uid)}
                              style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {/* Sessions */}
          {entries.length === 0 ? (
            <div className="empty-state"><p>No sessions logged for this job yet.</p></div>
          ) : (
            <>
              <div className="section-header" style={{ marginBottom: 12 }}>
                <h3>Sessions</h3>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{entries.length} total</span>
              </div>
              {entries.map((e) => {
                const { day, date } = formatDate(e.date);
                return (
                  <div key={e.id} className="ecard">
                    <div className="etop">
                      <div className="edate-wrap">
                        <span className="eday">{day}</span>
                        <span className="edate-txt">{date}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {e.status === "approved" && e.amount != null
                          ? <span className="eearned">{currency?.symbol}{formatAmount(e.amount)}</span>
                          : <span className="status-badge pending">Pending</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, fontWeight: 500 }}>
                      {e.workerName ?? "Unknown"}
                    </div>
                    {e.note && <div className="enote">{e.note}</div>}
                    <div className="emeta">
                      {e.hours}h{e.rate ? ` · ${currency?.symbol}${e.rate}/${job.rateType}` : ""}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamJobDetailPage() {
  return (
    <AuthGuard>
      <TeamJobDetailInner />
    </AuthGuard>
  );
}
