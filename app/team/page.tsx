"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import InviteLinkBox from "../../components/InviteLinkBox";
import SessionApprovalCard from "../../components/SessionApprovalCard";
import SettingsPopover, { GearButton } from "../../components/SettingsPopover";
import CurrencyPicker from "../../components/CurrencyPicker";
import RateTypeToggle from "../../components/RateTypeToggle";
import TeamWeeklyTimesheet from "../../components/TeamWeeklyTimesheet";
import LogTeamSessionModal from "../../components/LogTeamSessionModal";
import { useAuth } from "../../lib/AuthContext";
import {
  subscribeTeam,
  subscribeTeamJobs,
  subscribeAllTeamEntries,
  createJob,
  setPaidPeriod,
  approveEntry,
  ensureTeamAdminEmail,
  updateEntry,
  deleteEntry,
} from "../../lib/firestoreService";
import { getCurrencyByCode } from "../../lib/currencies";
import { sanitizeText, formatDate, formatAmount } from "../../lib/utils";
import type { Team, Job, Entry, RateType, TeamMember } from "../../lib/types";

type Tab = "overview" | "pending" | "members" | "timesheet";
type TimeFrame = "7d" | "30d" | "month" | "all";

// ── Helpers ──────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Add Job Modal ─────────────────────────────────────────────────────────────

function AddJobModal({ onClose, teamId, ownerUid }: { onClose: () => void; teamId: string; ownerUid: string }) {
  const [name, setName] = useState("");
  const [cur, setCur] = useState("USD");
  const [rateType, setRateType] = useState<RateType>("hour");
  const [defRate, setDefRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Job name required."); return; }
    setSaving(true);
    try {
      const currency = getCurrencyByCode(cur);
      const jobData: Parameters<typeof createJob>[0] = {
        name: sanitizeText(name, 60),
        cur: currency.code,
        curSymbol: currency.symbol,
        rateType,
        ownerUid,
        teamId,
      };
      if (defRate) jobData.defRate = parseFloat(defRate);
      await createJob(jobData);
      onClose();
    } catch {
      setError("Failed to add job.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
      <div style={{ width: "100%", background: "var(--surface)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", padding: "24px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 400 }}>Add Team Job</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <CloseIcon />
          </button>
        </div>
        {error && <div className="message message-error">{error}</div>}
        <form className="form" onSubmit={handleSubmit}>
          <div className="field"><label>Job Name</label>
            <input type="text" placeholder="e.g. Content Writing" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          </div>
          <div className="field"><label>Currency</label><CurrencyPicker value={cur} onChange={setCur} /></div>
          <div className="field"><label>Pay Rate</label><RateTypeToggle value={rateType} onChange={setRateType} /></div>
          <div className="field"><label>Default Rate (optional)</label>
            <input type="number" placeholder="Amount" value={defRate} onChange={(e) => setDefRate(e.target.value)} min="0" step="0.01" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>{saving ? "Saving…" : "Add Job"}</button>
        </form>
      </div>
    </div>
  );
}

// ── Member Detail Panel ───────────────────────────────────────────────────────

function MemberDetailPanel({ uid, member, allEntries, jobs, onClose }: {
  uid: string;
  member: TeamMember;
  allEntries: Entry[];
  jobs: Job[];
  onClose: () => void;
}) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("all");

  const memberEntries = allEntries.filter((e) => e.workerUid === uid);

  function filterByTime(list: Entry[]): Entry[] {
    if (timeFrame === "all") return list;
    const now = new Date();
    const cutoff = new Date(now);
    if (timeFrame === "7d") cutoff.setDate(now.getDate() - 7);
    else if (timeFrame === "30d") cutoff.setDate(now.getDate() - 30);
    else if (timeFrame === "month") { cutoff.setDate(1); cutoff.setHours(0, 0, 0, 0); }
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return list.filter((e) => e.date >= cutoffStr);
  }

  const filtered = filterByTime(memberEntries);
  const totalHours = filtered.reduce((s, e) => s + e.hours, 0);
  const approvedEntries = filtered.filter((e) => e.status === "approved" && e.amount != null);
  const pendingEntries = filtered.filter((e) => e.status === "pending");
  const pendingHours = pendingEntries.reduce((s, e) => s + e.hours, 0);

  // Group approved earnings by currency
  const earnByCur: Record<string, { symbol: string; total: number }> = {};
  approvedEntries.forEach((e) => {
    const job = jobs.find((j) => j.id === e.jobId);
    const cur = job?.cur ?? "?";
    if (!earnByCur[cur]) earnByCur[cur] = { symbol: job?.curSymbol ?? "", total: 0 };
    earnByCur[cur].total += e.amount ?? 0;
  });

  const joinedDate =
    member.joinedAt && typeof member.joinedAt.toDate === "function"
      ? member.joinedAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";

  const tfLabels: Record<TimeFrame, string> = { "7d": "7 days", "30d": "30 days", "month": "This month", "all": "All time" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
      <div style={{ width: "100%", background: "var(--surface)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", padding: "24px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="member-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 400 }}>{member.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Joined {joinedDate}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <CloseIcon />
          </button>
        </div>

        {/* Time frame filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {(["7d", "30d", "month", "all"] as TimeFrame[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTimeFrame(t)}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: timeFrame === t ? 600 : 400,
                background: timeFrame === t ? "var(--gold)" : "var(--surface2)",
                color: timeFrame === t ? "#0d0d0d" : "var(--muted)",
                border: "none",
                borderRadius: 99,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              {tfLabels[t]}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{+totalHours.toFixed(3)}h</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Hours worked</div>
          </div>
          <div className="card" style={{ padding: "14px 16px" }}>
            {Object.values(earnByCur).length > 0
              ? Object.entries(earnByCur).map(([cur, { symbol, total }]) => (
                  <div key={cur} style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>{symbol}{formatAmount(total)}</div>
                ))
              : <div style={{ fontSize: 18, fontWeight: 600 }}>—</div>}
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Earned (approved)</div>
          </div>
          {pendingHours > 0 && (
            <div className="card" style={{ padding: "14px 16px", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{+pendingHours.toFixed(3)}h</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Pending approval</div>
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="section-header" style={{ marginBottom: 10 }}><h3>Sessions</h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No sessions in this period.</p></div>
        ) : (
          filtered.map((e) => {
            const job = jobs.find((j) => j.id === e.jobId);
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
                      ? <span className="eearned">{job?.curSymbol}{formatAmount(e.amount)}</span>
                      : <span className="status-badge pending">Pending</span>}
                  </div>
                </div>
                {job && <span className="ejob-tag">{job.name}</span>}
                {e.note && <div className="enote">{e.note}</div>}
                <div className="emeta">{e.hours}h{e.rate ? ` · ${job?.curSymbol}${e.rate}/${job?.rateType}` : ""}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

function TeamDashboardInner() {
  const { user, userProfile, refreshProfile } = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState<Team | null>(null);
  const [teamId, setTeamId] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ uid: string; member: TeamMember } | null>(null);
  const [logSessionJob, setLogSessionJob] = useState<Job | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [mySessOpen, setMySessOpen] = useState(false);

  const name = userProfile?.name ?? "";
  const teamName = userProfile?.teamName ?? team?.name ?? "Your Team";

  // Derive pending entries from all entries
  const pendingEntries = allEntries.filter((e) => e.status === "pending");
  const myEntries = allEntries
    .filter((e) => e.workerUid === user?.uid)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Redirect non-team users away
  useEffect(() => {
    if (userProfile && userProfile.type !== "team") {
      router.replace("/dashboard");
    }
  }, [userProfile, router]);

  // Resolve teamId: prefer Firestore profile, fallback to sessionStorage
  useEffect(() => {
    if (!user || !userProfile) return;
    if (userProfile.adminTeamId) {
      setTeamId(userProfile.adminTeamId);
      try { sessionStorage.setItem("rl-my-team-id", userProfile.adminTeamId); } catch { /* ignore */ }
      return;
    }
    try {
      const stored = sessionStorage.getItem("rl-my-team-id");
      if (stored) { setTeamId(stored); return; }
    } catch { /* ignore */ }
  }, [user, userProfile]);

  useEffect(() => {
    if (!teamId) return;
    const unsub = subscribeTeam(teamId, (t) => {
      setTeam(t);
      if (t && !t.adminEmail && user?.email) {
        ensureTeamAdminEmail(teamId, user.email).catch(() => {});
      }
    });
    return unsub;
  }, [teamId, user]);

  useEffect(() => {
    if (!teamId) return;
    const unsubJobs = subscribeTeamJobs(teamId, setJobs);
    const unsubEntries = subscribeAllTeamEntries(teamId, setAllEntries);
    return () => { unsubJobs(); unsubEntries(); };
  }, [teamId]);

  function handleSignOut() {
    refreshProfile().catch(() => {});
    router.replace("/");
  }

  const memberEntries = Object.entries(team?.members ?? {});
  const memberCount = memberEntries.length;

  return (
    <div className="dash-shell">
      {/* Top bar */}
      <div className="top-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <div className="brand-logo" style={{ width: 36, height: 36, fontSize: 14 }}>
            {(teamName || "T").charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 400, lineHeight: 1.2 }}>{teamName}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{memberCount} member{memberCount !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <GearButton onClick={() => setSettingsOpen((v) => !v)} />
          <SettingsPopover open={settingsOpen} onClose={() => setSettingsOpen(false)} onSignOut={handleSignOut} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="dash-tabs">
        <button className={`dash-tab${tab === "overview" ? " active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
        <button className={`dash-tab${tab === "pending" ? " active" : ""}`} onClick={() => setTab("pending")}>
          Pending {pendingEntries.length > 0 && (
            <span style={{ marginLeft: 4, background: "var(--gold)", color: "#0d0d0d", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>
              {pendingEntries.length}
            </span>
          )}
        </button>
        <button className={`dash-tab${tab === "members" ? " active" : ""}`} onClick={() => setTab("members")}>Members</button>
        <button className={`dash-tab${tab === "timesheet" ? " active" : ""}`} onClick={() => setTab("timesheet")}>Timesheet</button>
      </div>

      <div className="dash-content">
        {/* Overview */}
        {tab === "overview" && (
          <div className="page-content">
            {team && <InviteLinkBox inviteCode={team.inviteCode} />}

            {/* My Sessions */}
            <div style={{ marginBottom: 24 }}>
              <button
                type="button"
                onClick={() => setMySessOpen((v) => !v)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
              >
                <span style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 400 }}>My Sessions</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {myEntries.length} {mySessOpen ? "▾" : "▸"}
                </span>
              </button>
              {mySessOpen && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {myEntries.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>No sessions logged yet.</div>
                  ) : (
                    myEntries.map((entry) => {
                      const job = jobs.find((j) => j.id === entry.jobId);
                      return (
                        <div key={entry.id} style={{ background: "var(--surface2)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 14 }}>{job?.name ?? "—"}</div>
                              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                                {entry.date} · {+entry.hours.toFixed(3)}h
                                {entry.note && <> · {entry.note.slice(0, 60)}{entry.note.length > 60 ? "…" : ""}</>}
                              </div>
                            </div>
                            <span style={{
                              fontSize: 11, padding: "2px 8px", borderRadius: 99, flexShrink: 0,
                              background: entry.status === "approved" ? "rgba(61,186,126,0.15)" : "rgba(212,175,55,0.15)",
                              color: entry.status === "approved" ? "#3dba7e" : "var(--gold)",
                            }}>
                              {entry.status === "approved"
                                ? entry.amount != null ? `${job?.curSymbol ?? ""}${formatAmount(entry.amount)}` : "approved"
                                : "pending"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="section-header">
              <h3>Team Jobs</h3>
              <button className="btn-add-small" onClick={() => setAddJobOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add
              </button>
            </div>
            {jobs.length === 0 ? (
              <div className="empty-state"><p>No team jobs yet. Add a job that your members can log sessions for.</p></div>
            ) : (
              <div className="job-grid">
                {jobs.map((job) => {
                  const jobEntries = allEntries.filter((e) => e.jobId === job.id);
                  const approvedEntries = jobEntries.filter((e) => e.status === "approved" && e.amount != null);
                  const totalEarned = approvedEntries.reduce((s, e) => s + (e.amount ?? 0), 0);
                  const totalHours = jobEntries.reduce((s, e) => s + e.hours, 0);
                  const pendingCount = jobEntries.filter((e) => e.status === "pending").length;
                  return (
                    <div
                      key={job.id}
                      className="job-tile"
                      onClick={() => router.push(`/team/job/${job.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="job-tile-name">{job.name}</div>
                      <div className="job-tile-amount">{job.curSymbol}{formatAmount(totalEarned)}</div>
                      <div className="job-tile-meta">
                        {+totalHours.toFixed(3)}h logged
                        {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
                      </div>
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); setLogSessionJob(job); }}
                        style={{ marginTop: 12, fontSize: 13, fontWeight: 600, padding: "9px 12px", background: "var(--gold)", border: "none", borderRadius: "var(--radius)", cursor: "pointer", color: "#0d0d0d", width: "100%", boxShadow: "0 0 12px rgba(201,168,76,0.5)" }}
                      >
                        + Log My Session
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pending approvals */}
        {tab === "pending" && (
          <div className="page-content">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Review session logs from your team members. Set a rate and approve, or reject.
              </div>
            </div>
            {pendingEntries.length === 0 ? (
              <div className="empty-state"><p>No pending sessions. You&apos;re all caught up!</p></div>
            ) : (
              <>
                {/* Bulk approve with default rate */}
                {(() => {
                  const approvable = pendingEntries.filter((e) => {
                    const job = jobs.find((j) => j.id === e.jobId);
                    return (job?.memberRates?.[e.workerUid] ?? job?.defRate) != null;
                  });
                  const skipped = pendingEntries.length - approvable.length;
                  if (approvable.length === 0) return null;
                  return (
                    <div className="card" style={{ padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Apply default rate to all</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {approvable.length} session{approvable.length !== 1 ? "s" : ""} will be approved
                          {skipped > 0 && ` · ${skipped} skipped (no default rate)`}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={approvingAll}
                        onClick={async () => {
                          setApprovingAll(true);
                          try {
                            await Promise.all(
                              approvable.map((e) => {
                                const job = jobs.find((j) => j.id === e.jobId)!;
                                const rate = job.memberRates?.[e.workerUid] ?? job.defRate!;
                                return approveEntry(e.id, e.hours * rate, rate);
                              })
                            );
                          } finally {
                            setApprovingAll(false);
                          }
                        }}
                        style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", cursor: "pointer", background: "var(--gold)", border: "none", color: "#0d0d0d", whiteSpace: "nowrap" }}
                      >
                        {approvingAll ? "Approving…" : "Approve All"}
                      </button>
                    </div>
                  );
                })()}

                {pendingEntries.map((entry) => (
                  <SessionApprovalCard
                    key={entry.id}
                    entry={entry}
                    job={jobs.find((j) => j.id === entry.jobId)}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Timesheet */}
        {tab === "timesheet" && (
          <div className="page-content">
            <TeamWeeklyTimesheet
              allEntries={allEntries}
              members={team?.members ?? {}}
              jobs={jobs}
              adminUid={user?.uid}
              adminName={name}
              paidPeriods={team?.paidPeriods ?? {}}
              onTogglePaid={async (startDate, paid) => {
                await setPaidPeriod(teamId, startDate, paid);
              }}
              onUpdateEntry={async (id, data) => { await updateEntry(id, data); }}
              onDeleteEntry={async (id) => { await deleteEntry(id); }}
            />
          </div>
        )}

        {/* Members */}
        {tab === "members" && (
          <div className="page-content">
            <div className="section-header" style={{ marginTop: 4 }}>
              <h3>Team Members</h3>
            </div>
            {!team || memberEntries.length === 0 ? (
              <div className="empty-state">
                <p>No members yet. Share your invite link to onboard people.</p>
                {team && <div style={{ marginTop: 16 }}><InviteLinkBox inviteCode={team.inviteCode} /></div>}
              </div>
            ) : (
              <div className="card" style={{ padding: "8px 0" }}>
                {memberEntries.map(([uid, member]) => {
                  const sessionCount = allEntries.filter((e) => e.workerUid === uid).length;
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => setSelectedMember({ uid, member })}
                      style={{ display: "flex", alignItems: "center", width: "100%", gap: 12, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: "1px solid var(--border)" }}
                    >
                      <div className="member-avatar">{member.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div className="member-name">{member.name}</div>
                        <div className="member-meta">
                          {member.joinedAt && typeof member.joinedAt.toDate === "function"
                            ? `Joined ${member.joinedAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                            : "—"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{sessionCount}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>session{sessionCount !== 1 ? "s" : ""}</div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)", flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hey greeting */}
      <div style={{ position: "fixed", bottom: 20, left: 20, fontSize: 12, color: "var(--muted)", pointerEvents: "none" }}>
        Hey, {name}
      </div>

      {addJobOpen && teamId && user && (
        <AddJobModal onClose={() => setAddJobOpen(false)} teamId={teamId} ownerUid={user.uid} />
      )}

      {logSessionJob && user && (
        <LogTeamSessionModal
          job={logSessionJob}
          workerUid={user.uid}
          workerName={name}
          onClose={() => setLogSessionJob(null)}
        />
      )}

      {selectedMember && (
        <MemberDetailPanel
          uid={selectedMember.uid}
          member={selectedMember.member}
          allEntries={allEntries}
          jobs={jobs}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}

export default function TeamPage() {
  return (
    <AuthGuard>
      <TeamDashboardInner />
    </AuthGuard>
  );
}
