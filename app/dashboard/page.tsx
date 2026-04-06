"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import Drawer from "../../components/Drawer";
import EarningsCard from "../../components/EarningsCard";
import JobDetailPanel from "../../components/JobDetailPanel";
import SettingsPopover, { GearButton } from "../../components/SettingsPopover";
import { useAuth } from "../../lib/AuthContext";
import {
  subscribeUserJobs,
  subscribeUserEntries,
  subscribeTeamJobs,
  subscribeTeam,
  removeMember,
  createEntry,
  createJob,
  updateEntry,
  deleteEntry,
} from "../../lib/firestoreService";
import { getCurrencyByCode } from "../../lib/currencies";
import { formatDate, formatAmount, formatHours, sanitizeText } from "../../lib/utils";
import type { Job, Entry } from "../../lib/types";
import CurrencyPicker from "../../components/CurrencyPicker";
import RateTypeToggle from "../../components/RateTypeToggle";
import LogTeamSessionModal from "../../components/LogTeamSessionModal";
import type { RateType } from "../../lib/types";

type Tab = "overview" | "sessions" | "myteam";

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function AddJobModal({ onClose, ownerUid }: { onClose: () => void; ownerUid: string }) {
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
    setError("");
    try {
      const currency = getCurrencyByCode(cur);
      const jobData: Parameters<typeof createJob>[0] = {
        name: sanitizeText(name, 60),
        cur: currency.code,
        curSymbol: currency.symbol,
        rateType,
        ownerUid,
      };
      if (defRate) jobData.defRate = parseFloat(defRate);
      await createJob(jobData);
      onClose();
    } catch {
      setError("Failed to add job. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
      <div style={{ width: "100%", background: "var(--surface)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", padding: "24px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 400 }}>Add a Job</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {error && <div className="message message-error">{error}</div>}
        <form className="form" onSubmit={handleSubmit}>
          <div className="field"><label>Job Name</label>
            <input type="text" placeholder="e.g. Freelance Writing" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          </div>
          <div className="field"><label>Currency</label>
            <CurrencyPicker value={cur} onChange={setCur} />
          </div>
          <div className="field"><label>Pay Rate</label>
            <RateTypeToggle value={rateType} onChange={setRateType} />
          </div>
          <div className="field"><label>Default Rate (optional)</label>
            <input type="number" placeholder="Amount" value={defRate} onChange={(e) => setDefRate(e.target.value)} min="0" step="0.01" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>{saving ? "Saving…" : "Add Job"}</button>
        </form>
      </div>
    </div>
  );
}

function DashboardInner() {
  const { user, userProfile, refreshProfile } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [teamJobs, setTeamJobs] = useState<Job[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [earningsHidden, setEarningsHidden] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobPanelOpen, setJobPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [logTeamJob, setLogTeamJob] = useState<Job | null>(null);

  // Session editing state
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [teamMap, setTeamMap] = useState<Record<string, string>>({});
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [confirmLeaveTeamId, setConfirmLeaveTeamId] = useState<string | null>(null);
  const [leavingTeam, setLeavingTeam] = useState(false);

  function startEdit(entry: Entry) {
    setEditingEntry(entry);
    setEditDate(entry.date);
    setEditHours(entry.hours.toString());
    setEditRate(entry.rate?.toString() ?? "");
    setEditNote(entry.note ?? "");
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEntry) return;
    const hours = parseFloat(editHours);
    if (isNaN(hours) || hours <= 0) { setEditError("Enter valid hours."); return; }
    const rate = editRate ? parseFloat(editRate) : (editingEntry.rate ?? 0);
    setEditSaving(true);
    setEditError("");
    try {
      await updateEntry(editingEntry.id, {
        date: editDate,
        hours,
        rate,
        amount: hours * rate,
        ...(editNote.trim() ? { note: sanitizeText(editNote, 300) } : {}),
      });
      setEditingEntry(null);
    } catch (err) {
      console.error("updateEntry failed:", err);
      setEditError("Failed to save. Try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    setDeletingId(entryId);
    try {
      await deleteEntry(entryId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("deleteEntry failed:", err);
    } finally {
      setDeletingId(null);
    }
  }

  const hasTeam = (userProfile?.joinedTeams?.length ?? 0) > 0;
  const name = userProfile?.name ?? "";
  const initial = name ? name.charAt(0).toUpperCase() : "R";

  useEffect(() => {
    if (!user) return;
    const unsubJobs = subscribeUserJobs(user.uid, setJobs);
    const unsubEntries = subscribeUserEntries(user.uid, setEntries);
    return () => { unsubJobs(); unsubEntries(); };
  }, [user]);

  // Subscribe to team jobs for each joined team
  useEffect(() => {
    const teamIds = userProfile?.joinedTeams ?? [];
    if (!teamIds.length) { setTeamJobs([]); return; }
    const jobsByTeam = new Map<string, Job[]>();
    const unsubs = teamIds.map((tid) =>
      subscribeTeamJobs(tid, (tjobs) => {
        jobsByTeam.set(tid, tjobs);
        const merged: Job[] = [];
        jobsByTeam.forEach((j) => merged.push(...j));
        setTeamJobs(merged);
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [userProfile]);

  // Subscribe to each team to get team names
  useEffect(() => {
    const teamIds = userProfile?.joinedTeams ?? [];
    if (!teamIds.length) { setTeamMap({}); return; }
    if (!selectedTeamId) setSelectedTeamId(teamIds[0]);
    const unsubs = teamIds.map((tid) =>
      subscribeTeam(tid, (team) => {
        if (team) setTeamMap((prev) => ({ ...prev, [tid]: team.name }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [userProfile]);

  function openJob(job: Job) {
    setSelectedJob(job);
    setJobPanelOpen(true);
    setDrawerOpen(false);
  }

  function handleSignOut() {
    refreshProfile().catch(() => {});
    router.replace("/");
  }

  async function handleLeaveTeam(teamId: string) {
    if (!user) return;
    setLeavingTeam(true);
    try {
      // Delete all entries the user logged for this team
      const entriesToDelete = entries.filter((e) => e.teamId === teamId && e.workerUid === user.uid);
      await Promise.all(entriesToDelete.map((e) => deleteEntry(e.id)));
      await removeMember(teamId, user.uid);
      await refreshProfile();
      setConfirmLeaveTeamId(null);
      if (selectedTeamId === teamId) setSelectedTeamId(null);
    } catch {
      // silently ignore — user stays on page
    } finally {
      setLeavingTeam(false);
    }
  }

  const personalEntries = entries.filter((e) => !e.teamId);
  const teamEntries = entries.filter((e) => !!e.teamId);

  return (
    <div className="dash-shell">
      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="drawer-header">
          <div className="drawer-avatar">{initial}</div>
          <div>
            <div className="drawer-user-name">{name}</div>
            <div className="drawer-user-email">{user?.email}</div>
          </div>
        </div>
        <nav className="drawer-nav">
          {([
            "overview",
            "sessions",
            ...(hasTeam ? ["myteam"] : []),
          ] as Tab[]).map((t) => (
            <button
              key={t}
              className={`drawer-nav-item${tab === t ? " active" : ""}`}
              onClick={() => { setTab(t); setDrawerOpen(false); }}
            >
              {t === "overview" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
              {t === "sessions" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
              {t === "myteam" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              {t === "overview" ? "Overview" : t === "sessions" ? "Sessions" : "My Team"}
            </button>
          ))}
        </nav>
        <div className="drawer-footer">
          <button className="drawer-add-job" onClick={() => { setAddJobOpen(true); setDrawerOpen(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Job
          </button>
        </div>
      </Drawer>

      {/* Top bar */}
      <div className="top-bar">
        <button className="hamburger-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <HamburgerIcon />
        </button>
        <div className="top-bar-greeting">Hey, <span>{name}</span></div>
        <div style={{ position: "relative" }}>
          <GearButton onClick={() => setSettingsOpen((v) => !v)} />
          <SettingsPopover open={settingsOpen} onClose={() => setSettingsOpen(false)} onSignOut={handleSignOut} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="dash-tabs">
        <button className={`dash-tab${tab === "overview" ? " active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
        <button className={`dash-tab${tab === "sessions" ? " active" : ""}`} onClick={() => setTab("sessions")}>Sessions</button>
        {hasTeam && <button className={`dash-tab${tab === "myteam" ? " active" : ""}`} onClick={() => setTab("myteam")}>My Team</button>}
      </div>

      {/* Tab content */}
      <div className="dash-content">
        {tab === "overview" && (
          <>
            <EarningsCard
              jobs={jobs}
              entries={personalEntries}
              hidden={earningsHidden}
              onToggleHidden={() => setEarningsHidden((v) => !v)}
            />
            <div className="page-content" style={{ paddingTop: 0 }}>
              <div className="section-header">
                <h3>Your Jobs</h3>
                <button className="btn-add-small" onClick={() => setAddJobOpen(true)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add
                </button>
              </div>
              {jobs.length === 0 ? (
                <div className="empty-state"><p>No jobs yet. Add a job to start tracking.</p></div>
              ) : (
                <div className="job-grid">
                  {jobs.map((job) => {
                    const jobEntries = personalEntries.filter((e) => e.jobId === job.id && e.status === "approved");
                    const earned = jobEntries.reduce((s, e) => s + (e.amount ?? e.hours * (e.rate ?? 0)), 0);
                    const hours = jobEntries.reduce((s, e) => s + e.hours, 0);
                    return (
                      <button key={job.id} className="job-tile" onClick={() => openJob(job)}>
                        <div className="job-tile-name">{job.name}</div>
                        <div className={`job-tile-amount${earningsHidden ? " earnings-hidden" : ""}`}>
                          {job.curSymbol}{formatAmount(earned)}
                        </div>
                        <div className="job-tile-meta">
                          {jobEntries.length} session{jobEntries.length !== 1 ? "s" : ""} · {hours.toFixed(1)}h
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "sessions" && (
          <div className="page-content">
            <div className="section-header" style={{ marginTop: 4 }}>
              <h3>Sessions</h3>
            </div>
            {personalEntries.length === 0 ? (
              <div className="empty-state"><p>No sessions logged yet.</p></div>
            ) : (() => {
              // Group entries by Mon-Sun week
              function getWeekKey(dateStr: string): string {
                const d = new Date(dateStr + "T00:00:00");
                const day = d.getDay();
                d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
                const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
                return `${y}-${mo}-${dd}`;
              }
              function weekLabel(mondayStr: string): string {
                const mon = new Date(mondayStr + "T00:00:00");
                const sun = new Date(mondayStr + "T00:00:00");
                sun.setDate(sun.getDate() + 6);
                const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return `${fmt(mon)} – ${fmt(sun)}`;
              }
              const weekMap: Record<string, typeof personalEntries> = {};
              personalEntries.forEach((e) => {
                const key = getWeekKey(e.date);
                if (!weekMap[key]) weekMap[key] = [];
                weekMap[key].push(e);
              });
              const weeks = Object.keys(weekMap).sort((a, b) => b.localeCompare(a));
              return weeks.map((mondayStr) => {
                const weekEntries = weekMap[mondayStr];
                const totalHours = weekEntries.reduce((s, e) => s + e.hours, 0);
                const totalEarned = weekEntries.reduce((s, e) => s + (e.amount ?? e.hours * (e.rate ?? 0)), 0);
                const isOpen = expandedWeek === mondayStr;
                return (
                  <div key={mondayStr} className="card" style={{ marginBottom: 10, overflow: "hidden" }}>
                    {/* Week header — click to expand/collapse */}
                    <button
                      type="button"
                      onClick={() => setExpandedWeek(isOpen ? null : mondayStr)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{weekLabel(mondayStr)}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {weekEntries.length} session{weekEntries.length !== 1 ? "s" : ""} · {formatHours(totalHours)}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className={`eearned${earningsHidden ? " earnings-hidden" : ""}`} style={{ fontSize: 15, fontWeight: 700 }}>
                          {jobs.find((j) => j.id === weekEntries[0]?.jobId)?.curSymbol ?? ""}{formatAmount(totalEarned)}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ color: "var(--muted)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    </button>

                    {/* Expanded sessions */}
                    {isOpen && (
                      <div style={{ borderTop: "1px solid var(--border)" }}>
                        {weekEntries.map((e) => {
                          const job = jobs.find((j) => j.id === e.jobId);
                          const { day, date } = formatDate(e.date);
                          const earned = e.amount ?? (e.hours * (e.rate ?? 0));
                          const isEditing = editingEntry?.id === e.id;
                          const isConfirmDel = confirmDeleteId === e.id;
                          return (
                            <div key={e.id} className="ecard" style={{ borderRadius: 0, border: "none", borderBottom: "1px solid var(--border)" }}>
                              {isEditing ? (
                                <form onSubmit={handleSaveEdit} className="form" style={{ gap: 10 }}>
                                  {editError && <div className="message message-error" style={{ fontSize: 12 }}>{editError}</div>}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <div className="field" style={{ margin: 0 }}>
                                      <label style={{ fontSize: 11 }}>Date</label>
                                      <input type="date" value={editDate} onChange={(ev) => setEditDate(ev.target.value)} required />
                                    </div>
                                    <div className="field" style={{ margin: 0 }}>
                                      <label style={{ fontSize: 11 }}>Hours</label>
                                      <input type="number" value={editHours} onChange={(ev) => setEditHours(ev.target.value)} min="0.1" step="0.1" required />
                                    </div>
                                    <div className="field" style={{ margin: 0 }}>
                                      <label style={{ fontSize: 11 }}>Rate ({job?.curSymbol}/{job?.rateType ?? "hr"})</label>
                                      <input type="number" value={editRate} onChange={(ev) => setEditRate(ev.target.value)} min="0" step="0.01" />
                                    </div>
                                    <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}>
                                      <label style={{ fontSize: 11 }}>Note</label>
                                      <textarea value={editNote} onChange={(ev) => setEditNote(ev.target.value)} maxLength={300} rows={2} />
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                    <button type="button" className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => setEditingEntry(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} disabled={editSaving}>{editSaving ? "Saving…" : "Save"}</button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <div className="etop">
                                    <div className="edate-wrap">
                                      <span className="eday">{day}</span>
                                      <span className="edate-txt">{date}</span>
                                    </div>
                                    <span className={`eearned${earningsHidden ? " earnings-hidden" : ""}`}>
                                      {job?.curSymbol ?? ""}{formatAmount(earned)}
                                    </span>
                                  </div>
                                  {job && <span className="ejob-tag">{job.name}</span>}
                                  {e.note && <div className="enote">{e.note}</div>}
                                  <div className="emeta">{e.hours}h · {job?.curSymbol ?? ""}{e.rate ?? 0}/{job?.rateType ?? "hr"}</div>
                                  {isConfirmDel ? (
                                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                      <button type="button" className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                                      <button type="button" className="btn btn-primary" style={{ flex: 1, fontSize: 12, background: "#e05454", borderColor: "#e05454" }} onClick={() => handleDeleteEntry(e.id)} disabled={deletingId === e.id}>{deletingId === e.id ? "…" : "Delete"}</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                      <button type="button" className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => startEdit(e)}>Edit</button>
                                      <button type="button" className="btn btn-ghost" style={{ flex: 1, fontSize: 12, color: "#e05454" }} onClick={() => setConfirmDeleteId(e.id)}>Delete</button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {tab === "myteam" && (
          <div className="page-content">
            {(() => {
              const teamIds = userProfile?.joinedTeams ?? [];
              const currentTeamId = selectedTeamId ?? teamIds[0] ?? null;
              const currentTeamEntries = teamEntries.filter((e) => e.teamId === currentTeamId);
              const currentTeamJobs = teamJobs.filter((j) => j.teamId === currentTeamId);

              // Earnings for current team
              const approvedEarnings: Record<string, { symbol: string; total: number }> = {};
              currentTeamEntries
                .filter((e) => e.status === "approved" && e.amount != null)
                .forEach((e) => {
                  const job = currentTeamJobs.find((j) => j.id === e.jobId);
                  const cur = job?.cur ?? "?";
                  if (!approvedEarnings[cur]) approvedEarnings[cur] = { symbol: job?.curSymbol ?? "", total: 0 };
                  approvedEarnings[cur].total += e.amount ?? 0;
                });
              const approvedCurrencies = Object.entries(approvedEarnings);
              const pendingCount = currentTeamEntries.filter((e) => e.status === "pending").length;
              const totalHours = currentTeamEntries.reduce((s, e) => s + e.hours, 0);
              const approvedHours = currentTeamEntries.filter((e) => e.status === "approved").reduce((s, e) => s + e.hours, 0);
              const pendingEstByCur: Record<string, { symbol: string; total: number }> = {};
              currentTeamEntries.filter((e) => e.status === "pending").forEach((e) => {
                const job = currentTeamJobs.find((j) => j.id === e.jobId);
                if (!job?.defRate) return;
                if (!pendingEstByCur[job.cur]) pendingEstByCur[job.cur] = { symbol: job.curSymbol, total: 0 };
                pendingEstByCur[job.cur].total += e.hours * job.defRate;
              });
              const pendingEstEntries = Object.entries(pendingEstByCur);

              return (
                <>
                  {/* Team tabs — only shown when in multiple teams */}
                  {teamIds.length > 1 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
                      {teamIds.map((tid) => (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => setSelectedTeamId(tid)}
                          style={{
                            padding: "7px 16px", fontSize: 13, borderRadius: 99, cursor: "pointer",
                            background: currentTeamId === tid ? "var(--gold)" : "var(--surface2)",
                            color: currentTeamId === tid ? "#0d0d0d" : "var(--muted)",
                            border: currentTeamId === tid ? "none" : "1px solid var(--border)",
                            fontWeight: currentTeamId === tid ? 600 : 400,
                          }}
                        >
                          {teamMap[tid] ?? "Team"}
                        </button>
                      ))}
                      {currentTeamId && (
                        <button
                          type="button"
                          onClick={() => setConfirmLeaveTeamId(currentTeamId)}
                          style={{ marginLeft: "auto", fontSize: 12, padding: "5px 12px", borderRadius: 99, cursor: "pointer", background: "none", border: "1px solid var(--border)", color: "var(--muted)" }}
                        >
                          Leave team
                        </button>
                      )}
                    </div>
                  )}
                  {teamIds.length === 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
                        {teamMap[teamIds[0]] ?? "My Team"}
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmLeaveTeamId(teamIds[0])}
                        style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, cursor: "pointer", background: "none", border: "1px solid var(--border)", color: "var(--muted)" }}
                      >
                        Leave team
                      </button>
                    </div>
                  )}

                  {/* Leave team confirmation */}
                  {confirmLeaveTeamId && (
                    <div className="card" style={{ padding: "16px 18px", marginBottom: 16, border: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 14, marginBottom: 14 }}>
                        Leave <strong>{teamMap[confirmLeaveTeamId] ?? "this team"}</strong>? All your session history for this team will be permanently deleted. This cannot be undone.
                      </p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setConfirmLeaveTeamId(null)}
                          style={{ flex: 1, padding: "8px", fontSize: 13, borderRadius: "var(--radius)", cursor: "pointer", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={leavingTeam}
                          onClick={() => handleLeaveTeam(confirmLeaveTeamId)}
                          style={{ flex: 1, padding: "8px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius)", cursor: "pointer", background: "#c0392b", border: "none", color: "#fff" }}
                        >
                          {leavingTeam ? "Leaving…" : "Leave Team"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Team Earnings card */}
                  <div className="card" style={{ padding: "18px 20px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>Team Earnings</span>
                      <button
                        type="button"
                        onClick={() => setEarningsHidden((v) => !v)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}
                        aria-label={earningsHidden ? "Show earnings" : "Hide earnings"}
                      >
                        {earningsHidden ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                    {approvedCurrencies.length === 0 ? (
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>No approved earnings yet.</div>
                    ) : (
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        {approvedCurrencies.map(([cur, { symbol, total }]) => (
                          <div key={cur}>
                            <div className={`eearned${earningsHidden ? " earnings-hidden" : ""}`} style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>
                              {symbol}{formatAmount(total)}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{cur}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {totalHours > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--muted)" }}>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>{totalHours.toFixed(1)}h</span> total logged
                        {approvedHours > 0 && approvedHours !== totalHours && (
                          <> · <span style={{ fontWeight: 600, color: "var(--text)" }}>{approvedHours.toFixed(1)}h</span> approved</>
                        )}
                      </div>
                    )}
                    {pendingEstEntries.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                        Est. from pending:{" "}
                        {pendingEstEntries.map(([cur, { symbol, total }], i) => (
                          <span key={cur}>{i > 0 ? " · " : ""}<span style={{ fontWeight: 500 }}>{symbol}{formatAmount(total)}</span> {cur}</span>
                        ))}
                      </div>
                    )}
                    {pendingCount > 0 && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        {pendingCount} session{pendingCount !== 1 ? "s" : ""} pending approval
                      </div>
                    )}
                  </div>

                  {/* Team Jobs for current team */}
                  {currentTeamJobs.length > 0 && (
                    <>
                      <div className="section-header" style={{ marginTop: 4 }}>
                        <h3>Team Jobs</h3>
                      </div>
                      <div className="job-grid" style={{ marginBottom: 24 }}>
                        {currentTeamJobs.map((job) => (
                          <button
                            key={job.id}
                            className="job-tile"
                            onClick={() => setLogTeamJob(job)}
                          >
                            <div className="job-tile-name">{job.name}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                              {job.curSymbol} · {job.rateType === "hour" ? "Per hour" : "Per day"}
                            </div>
                            <div className="job-tile-meta" style={{ color: "var(--gold)", marginTop: 6 }}>
                              Tap to log session
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* My Sessions toggle */}
                  <button
                    type="button"
                    onClick={() => setSessionsOpen((v) => !v)}
                    style={{
                      width: "100%", padding: "12px 16px", fontSize: 14, fontWeight: 600,
                      background: sessionsOpen ? "var(--surface2)" : "var(--surface2)",
                      border: "1px solid var(--border)", borderRadius: "var(--radius)",
                      cursor: "pointer", color: "var(--text)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: sessionsOpen ? 12 : 0,
                    }}
                  >
                    <span>My Sessions</span>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: sessionsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {/* Sessions grouped by team */}
                  {sessionsOpen && (
                    <div style={{ marginBottom: 8 }}>
                      {teamIds.length === 0 ? (
                        <div className="empty-state"><p>No team sessions yet.</p></div>
                      ) : teamIds.map((tid) => {
                        const tEntries = teamEntries.filter((e) => e.teamId === tid);
                        const tJobs = teamJobs.filter((j) => j.teamId === tid);
                        return (
                          <div key={tid} style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                              {teamMap[tid] ?? "Team"}
                            </div>
                            {tEntries.length === 0 ? (
                              <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>No sessions logged yet.</div>
                            ) : (
                              <div className="card" style={{ padding: "0 0 4px" }}>
                                {tEntries.map((e) => {
                                  const job = tJobs.find((j) => j.id === e.jobId);
                                  const { day, date } = formatDate(e.date);
                                  return (
                                    <div key={e.id} className="team-entry-row">
                                      <div className="team-entry-left">
                                        <h4>{job?.name ?? "Team Job"}</h4>
                                        <p>{day} {date} · {e.hours}h</p>
                                      </div>
                                      <div className="team-entry-right">
                                        {e.status === "approved" && e.amount != null ? (
                                          <div className={`team-entry-amount${earningsHidden ? " earnings-hidden" : ""}`}>
                                            {job?.curSymbol ?? ""}{formatAmount(e.amount)}
                                          </div>
                                        ) : (
                                          <div className="team-entry-amount pending">Pending</div>
                                        )}
                                        <span className={`status-badge ${e.status}`}>{e.status}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Job Detail Panel */}
      <JobDetailPanel
        job={selectedJob}
        open={jobPanelOpen}
        onClose={() => setJobPanelOpen(false)}
        onDelete={() => { setJobPanelOpen(false); setSelectedJob(null); }}
        workerUid={user?.uid ?? ""}
        workerName={name}
      />

      {/* Add Job Modal */}
      {addJobOpen && <AddJobModal onClose={() => setAddJobOpen(false)} ownerUid={user?.uid ?? ""} />}

      {/* Log Team Session Modal */}
      {logTeamJob && user && (
        <LogTeamSessionModal
          job={logTeamJob}
          workerUid={user.uid}
          workerName={name}
          onClose={() => setLogTeamJob(null)}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardInner />
    </AuthGuard>
  );
}
