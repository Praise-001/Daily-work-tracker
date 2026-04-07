"use client";
import { useState, useMemo, Fragment } from "react";
import type { Entry, Job, TeamMember } from "../lib/types";
import { formatHours, formatAmount } from "../lib/utils";

interface Props {
  allEntries: Entry[];
  members: Record<string, TeamMember>;
  jobs: Job[];
  adminUid?: string;
  adminName?: string;
  paidPeriods?: Record<string, boolean>;
  onTogglePaid?: (startDate: string, paid: boolean) => void;
  onUpdateEntry?: (entryId: string, data: Partial<Pick<Entry, "date" | "hours" | "rate" | "note" | "amount">>) => Promise<void>;
  onDeleteEntry?: (entryId: string) => Promise<void>;
}

// Local-time-safe date string (fixes UTC off-by-one in UTC+1)
function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMondayStr(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateStr(d);
}

function getSundayStr(mondayStr: string): string {
  const d = new Date(mondayStr + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return toDateStr(d);
}

function getRangeDays(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const [from, to] = s <= e ? [s, e] : [e, s];
  const d = new Date(from);
  while (d <= to && days.length < 62) {
    days.push(toDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const cell: React.CSSProperties = {
  padding: "9px 10px",
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const dateInput: React.CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text)",
  fontSize: 13,
  padding: "7px 10px",
  fontFamily: "inherit",
  cursor: "pointer",
};

const pillBase: React.CSSProperties = {
  padding: "5px 12px", fontSize: 12, borderRadius: 99, cursor: "pointer", fontFamily: "inherit",
};

function PillBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...pillBase,
        background: active ? "var(--gold)" : "var(--surface2)",
        color: active ? "#0d0d0d" : "var(--muted)",
        border: active ? "none" : "1px solid var(--border)",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

export default function TeamWeeklyTimesheet({ allEntries, members, jobs, adminUid, adminName, paidPeriods, onTogglePaid, onUpdateEntry, onDeleteEntry }: Props) {
  const monday = getMondayStr();
  const [startDate, setStartDate] = useState<string>(monday);
  const [endDate, setEndDate] = useState<string>(getSundayStr(monday));
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [selectedMemberUid, setSelectedMemberUid] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ date: "", hours: "", rate: "", note: "" });
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);

  const isPaid = !!(paidPeriods?.[startDate]);
  const canEdit = !!(onUpdateEntry || onDeleteEntry);

  const rangeDays = useMemo(() => getRangeDays(startDate, endDate), [startDate, endDate]);

  const memberList = useMemo(() => {
    const list = Object.entries(members);
    if (adminUid && adminName) {
      return [[adminUid, { name: adminName } as TeamMember], ...list] as [string, TeamMember][];
    }
    return list;
  }, [members, adminUid, adminName]);

  const visibleMembers = useMemo(() => {
    if (selectedMemberUid) return memberList.filter(([uid]) => uid === selectedMemberUid);
    return memberList;
  }, [memberList, selectedMemberUid]);

  // Filter entries by date range and optionally by job
  const filteredEntries = useMemo(() => {
    return allEntries.filter((e) => {
      const inRange = rangeDays.includes(e.date);
      const inJob = selectedJobId === "all" || e.jobId === selectedJobId;
      return inRange && inJob && e.status === "approved";
    });
  }, [allEntries, rangeDays, selectedJobId]);

  const hoursGrid = useMemo(() => {
    const grid: Record<string, Record<string, number>> = {};
    memberList.forEach(([uid]) => { grid[uid] = {}; });
    filteredEntries.forEach((e) => {
      if (!grid[e.workerUid]) return;
      grid[e.workerUid][e.date] = (grid[e.workerUid][e.date] ?? 0) + e.hours;
    });
    return grid;
  }, [filteredEntries, memberList]);

  const entriesGrid = useMemo(() => {
    const grid: Record<string, Record<string, Entry[]>> = {};
    filteredEntries.forEach((e) => {
      if (!grid[e.date]) grid[e.date] = {};
      if (!grid[e.date][e.workerUid]) grid[e.date][e.workerUid] = [];
      grid[e.date][e.workerUid].push(e);
    });
    return grid;
  }, [filteredEntries]);

  // Rate: scoped to the selected job if one is chosen, else all-time approved
  const rateData = useMemo(() => {
    const result: Record<string, { rate: number; symbol: string }> = {};
    const scopedJob = selectedJobId !== "all" ? jobs.find((j) => j.id === selectedJobId) : undefined;

    memberList.forEach(([uid]) => {
      const approvedPool = allEntries.filter(
        (e) =>
          e.workerUid === uid &&
          e.status === "approved" &&
          (e.amount ?? 0) > 0 &&
          e.hours > 0 &&
          (selectedJobId === "all" || e.jobId === selectedJobId)
      );
      let rate = 0;
      let symbol = "";
      if (approvedPool.length > 0) {
        const recent = [...approvedPool].sort((a, b) => b.date.localeCompare(a.date))[0];
        rate = recent.rate ?? (recent.amount! / recent.hours);
        symbol = jobs.find((j) => j.id === recent.jobId)?.curSymbol ?? "";
      } else if (scopedJob?.defRate) {
        rate = scopedJob.defRate;
        symbol = scopedJob.curSymbol;
      } else {
        const workerAll = allEntries.filter((e) => e.workerUid === uid);
        const jobCount: Record<string, number> = {};
        workerAll.forEach((e) => { jobCount[e.jobId] = (jobCount[e.jobId] ?? 0) + 1; });
        const topJobId = Object.keys(jobCount).sort((a, b) => (jobCount[b] ?? 0) - (jobCount[a] ?? 0))[0];
        const job = jobs.find((j) => j.id === topJobId) ?? jobs[0];
        rate = job?.defRate ?? 0;
        symbol = job?.curSymbol ?? "";
      }
      result[uid] = { rate, symbol };
    });
    return result;
  }, [allEntries, memberList, jobs, selectedJobId]);

  function startEdit(entry: Entry) {
    setEditingEntryId(entry.id);
    setEditValues({
      date: entry.date,
      hours: String(entry.hours),
      rate: entry.rate != null ? String(entry.rate) : "",
      note: entry.note ?? "",
    });
  }

  async function saveEdit(entry: Entry) {
    if (!onUpdateEntry) return;
    const hrs = parseFloat(editValues.hours);
    if (isNaN(hrs) || hrs <= 0) return;
    const rateVal = parseFloat(editValues.rate);
    const hasRate = !isNaN(rateVal) && rateVal > 0;
    setSavingEntryId(entry.id);
    try {
      await onUpdateEntry(entry.id, {
        date: editValues.date,
        hours: hrs,
        ...(hasRate ? { rate: rateVal, amount: hrs * rateVal } : {}),
        note: editValues.note.trim() || undefined,
      });
      setEditingEntryId(null);
    } finally {
      setSavingEntryId(null);
    }
  }

  async function handleDelete(entryId: string) {
    if (!onDeleteEntry) return;
    await onDeleteEntry(entryId);
    if (editingEntryId === entryId) setEditingEntryId(null);
  }

  if (memberList.length === 0) {
    return <div className="empty-state"><p>No team members yet. Share your invite link to onboard people.</p></div>;
  }

  const rangeCount = rangeDays.length;
  const colSpan = visibleMembers.length + 2;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>

        {/* Member filter */}
        {memberList.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>Member</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <PillBtn label="All" active={selectedMemberUid === null} onClick={() => setSelectedMemberUid(null)} />
              {memberList.map(([uid, member]) => (
                <PillBtn
                  key={uid}
                  label={member.name.split(" ")[0]}
                  active={selectedMemberUid === uid}
                  onClick={() => setSelectedMemberUid(uid)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Job filter */}
        {jobs.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>Job</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <PillBtn label="All Jobs" active={selectedJobId === "all"} onClick={() => setSelectedJobId("all")} />
              {jobs.map((job) => (
                <PillBtn key={job.id} label={job.name} active={selectedJobId === job.id} onClick={() => setSelectedJobId(job.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Date range */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              const s = new Date(startDate + "T00:00:00"); s.setDate(s.getDate() - 7);
              const e = new Date(endDate + "T00:00:00"); e.setDate(e.getDate() - 7);
              setStartDate(toDateStr(s)); setEndDate(toDateStr(e));
            }}
            style={{ padding: "6px 12px", fontSize: 16, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text)", lineHeight: 1 }}
          >‹</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>From</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={dateInput} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>To</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={dateInput} />
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {rangeCount} day{rangeCount !== 1 ? "s" : ""}
            {rangeCount >= 62 ? " (max)" : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              const s = new Date(startDate + "T00:00:00"); s.setDate(s.getDate() + 7);
              const e = new Date(endDate + "T00:00:00"); e.setDate(e.getDate() + 7);
              setStartDate(toDateStr(s)); setEndDate(toDateStr(e));
            }}
            style={{ padding: "6px 12px", fontSize: 16, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text)", lineHeight: 1 }}
          >›</button>
        </div>
      </div>

      {/* Paid status bar */}
      {onTogglePaid && (
        <div
          onClick={() => onTogglePaid(startDate, !isPaid)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: "var(--radius)",
            cursor: "pointer",
            background: isPaid ? "rgba(61,186,126,0.12)" : "var(--surface2)",
            border: isPaid ? "1px solid rgba(61,186,126,0.3)" : "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: isPaid ? "#3dba7e" : "var(--border2)",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: isPaid ? "#3dba7e" : "var(--muted)" }}>
              {isPaid ? "Paid" : "Unpaid"}
            </span>
            {isPaid && <span style={{ fontSize: 11, color: "var(--muted)" }}>— tap to undo</span>}
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {isPaid ? "Mark as unpaid" : "Mark as paid"}
          </span>
        </div>
      )}

      {/* Scrollable table */}
      <div style={{ position: "relative" }}>
        {isPaid && (
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
            <span style={{ fontSize: 100, fontWeight: 900, color: "var(--gold)", opacity: 0.06, transform: "rotate(-35deg)", letterSpacing: 10, userSelect: "none", whiteSpace: "nowrap" }}>
              PAID
            </span>
          </div>
        )}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"], opacity: isPaid ? 0.45 : 1, transition: "opacity 0.25s" }}>
          <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
            <thead>
              <tr style={{ background: "var(--surface2)" }}>
                <th style={{ ...cell, textAlign: "left", color: "var(--muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", minWidth: 80 }}>
                  Day
                </th>
                {visibleMembers.map(([uid, member]) => (
                  <th key={uid} style={{ ...cell, color: "var(--muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", minWidth: 82 }}>
                    {member.name.split(" ")[0]}
                  </th>
                ))}
                <th style={{ ...cell, color: "var(--gold)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", minWidth: 82 }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rangeDays.map((dateStr, i) => {
                const dayTotal = visibleMembers.reduce((s, [uid]) => s + (hoursGrid[uid]?.[dateStr] ?? 0), 0);
                const isExpanded = expandedDate === dateStr;

                // Entries for this day (respect member filter)
                const dayEntries = Object.entries(entriesGrid[dateStr] ?? {})
                  .flatMap(([, entries]) => entries)
                  .filter((e) => !selectedMemberUid || e.workerUid === selectedMemberUid);

                return (
                  <Fragment key={dateStr}>
                    <tr
                      style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)", cursor: canEdit ? "pointer" : "default" }}
                      onClick={() => {
                        if (!canEdit) return;
                        setExpandedDate(isExpanded ? null : dateStr);
                        setEditingEntryId(null);
                      }}
                    >
                      <td style={{ ...cell, textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {canEdit && (
                            <span style={{ fontSize: 8, color: "var(--muted)", flexShrink: 0 }}>
                              {isExpanded ? "▾" : "▸"}
                            </span>
                          )}
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{dayLabel(dateStr)}</span>
                            <br />
                            <span style={{ fontSize: 10, color: "var(--muted)" }}>{shortDate(dateStr)}</span>
                          </div>
                        </div>
                      </td>
                      {visibleMembers.map(([uid]) => {
                        const h = hoursGrid[uid]?.[dateStr] ?? 0;
                        return (
                          <td key={uid} style={cell}>
                            {h > 0 ? formatHours(h) : <span style={{ color: "var(--border2)" }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ ...cell, fontWeight: 600, color: dayTotal > 0 ? "var(--text)" : "var(--border2)" }}>
                        {dayTotal > 0 ? formatHours(dayTotal) : "—"}
                      </td>
                    </tr>

                    {/* Expansion panel */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={colSpan} style={{ padding: 0, borderBottom: "1px solid var(--border)" }}>
                          <div style={{ background: "rgba(255,255,255,0.025)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                            {dayEntries.length === 0 ? (
                              <div style={{ padding: "8px 4px", fontSize: 13, color: "var(--muted)" }}>
                                No entries for this day.
                              </div>
                            ) : (
                              dayEntries.map((entry) => {
                                const workerName = memberList.find(([uid]) => uid === entry.workerUid)?.[1].name ?? entry.workerName ?? "Unknown";
                                const jobName = jobs.find((j) => j.id === entry.jobId)?.name ?? "";
                                const isEditing = editingEntryId === entry.id;
                                const isSaving = savingEntryId === entry.id;

                                if (isEditing) {
                                  return (
                                    <div key={entry.id} style={{ background: "var(--surface2)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
                                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                                        {workerName}{jobName ? ` · ${jobName}` : ""}
                                      </div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                                        <div>
                                          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>Date</div>
                                          <input
                                            type="date"
                                            value={editValues.date}
                                            onChange={(ev) => setEditValues((v) => ({ ...v, date: ev.target.value }))}
                                            style={{ ...dateInput, width: 136 }}
                                          />
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>Hours</div>
                                          <input
                                            type="number"
                                            value={editValues.hours}
                                            onChange={(ev) => setEditValues((v) => ({ ...v, hours: ev.target.value }))}
                                            min="0.001"
                                            step="0.001"
                                            style={{ ...dateInput, width: 82 }}
                                          />
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>Rate</div>
                                          <input
                                            type="number"
                                            value={editValues.rate}
                                            onChange={(ev) => setEditValues((v) => ({ ...v, rate: ev.target.value }))}
                                            min="0"
                                            step="0.01"
                                            placeholder="—"
                                            style={{ ...dateInput, width: 82 }}
                                          />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 120 }}>
                                          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>Note</div>
                                          <input
                                            type="text"
                                            value={editValues.note}
                                            onChange={(ev) => setEditValues((v) => ({ ...v, note: ev.target.value }))}
                                            maxLength={300}
                                            placeholder="—"
                                            style={{ ...dateInput, width: "100%", boxSizing: "border-box" }}
                                          />
                                        </div>
                                      </div>
                                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                        <button
                                          className="btn btn-primary"
                                          style={{ fontSize: 12, padding: "6px 18px" }}
                                          disabled={isSaving}
                                          onClick={(ev) => { ev.stopPropagation(); saveEdit(entry); }}
                                        >
                                          {isSaving ? "Saving…" : "Save"}
                                        </button>
                                        <button
                                          className="btn btn-ghost"
                                          style={{ fontSize: 12, padding: "6px 14px" }}
                                          onClick={(ev) => { ev.stopPropagation(); setEditingEntryId(null); }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={entry.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      padding: "8px 12px",
                                      background: "var(--surface2)",
                                      borderRadius: "var(--radius)",
                                      gap: 8,
                                    }}
                                  >
                                    <div style={{ fontSize: 13, lineHeight: 1.5, minWidth: 0 }}>
                                      <span style={{ fontWeight: 500 }}>{workerName}</span>
                                      {jobName && <span style={{ color: "var(--muted)", fontSize: 12 }}> · {jobName}</span>}
                                      <span style={{ color: "var(--muted)", fontSize: 12 }}> · {formatHours(entry.hours)}h</span>
                                      {entry.rate != null && entry.rate > 0 && (
                                        <span style={{ color: "var(--muted)", fontSize: 12 }}> · {entry.rate}</span>
                                      )}
                                      {entry.note && (
                                        <span style={{ color: "var(--muted)", fontSize: 12 }}> · {entry.note.slice(0, 50)}{entry.note.length > 50 ? "…" : ""}</span>
                                      )}
                                      <span style={{
                                        marginLeft: 6,
                                        fontSize: 10,
                                        padding: "1px 7px",
                                        borderRadius: 99,
                                        background: entry.status === "approved" ? "rgba(61,186,126,0.15)" : "rgba(212,175,55,0.15)",
                                        color: entry.status === "approved" ? "#3dba7e" : "var(--gold)",
                                      }}>
                                        {entry.status}
                                      </span>
                                    </div>
                                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                      {onUpdateEntry && (
                                        <button
                                          type="button"
                                          title="Edit"
                                          onClick={(ev) => { ev.stopPropagation(); startEdit(entry); }}
                                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px 6px", borderRadius: "var(--radius)" }}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                          </svg>
                                        </button>
                                      )}
                                      {onDeleteEntry && (
                                        <button
                                          type="button"
                                          title="Delete"
                                          onClick={(ev) => { ev.stopPropagation(); handleDelete(entry.id); }}
                                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px 6px", borderRadius: "var(--radius)" }}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                            <path d="M10 11v6M14 11v6"/>
                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {/* Separator */}
              <tr>
                <td colSpan={colSpan} style={{ padding: 0, height: 2, background: "var(--border2)" }} />
              </tr>

              {/* Total hours */}
              <tr>
                <td style={{ ...cell, textAlign: "left", fontWeight: 700, color: "var(--text)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Total
                </td>
                {visibleMembers.map(([uid]) => {
                  const total = rangeDays.reduce((s, d) => s + (hoursGrid[uid]?.[d] ?? 0), 0);
                  return (
                    <td key={uid} style={{ ...cell, fontWeight: 700 }}>
                      {total > 0 ? formatHours(total) : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                  );
                })}
                {(() => {
                  const grand = visibleMembers.reduce((s, [uid]) => s + rangeDays.reduce((ss, d) => ss + (hoursGrid[uid]?.[d] ?? 0), 0), 0);
                  return (
                    <td style={{ ...cell, fontWeight: 700, color: "var(--gold)" }}>
                      {grand > 0 ? formatHours(grand) : "—"}
                    </td>
                  );
                })()}
              </tr>

              {/* Rate */}
              <tr>
                <td style={{ ...cell, textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Rate
                </td>
                {visibleMembers.map(([uid]) => {
                  const { rate, symbol } = rateData[uid] ?? { rate: 0, symbol: "" };
                  return (
                    <td key={uid} style={{ ...cell, color: "var(--muted)", fontSize: 12 }}>
                      {rate > 0 ? `${symbol}${rate.toLocaleString("en-US")}` : "—"}
                    </td>
                  );
                })}
                <td style={cell} />
              </tr>

              {/* Estimated Pay */}
              <tr style={{ background: "rgba(212,175,55,0.04)" }}>
                <td style={{ ...cell, textAlign: "left", fontWeight: 700, color: "var(--gold)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Est. Pay
                </td>
                {visibleMembers.map(([uid]) => {
                  const { rate, symbol } = rateData[uid] ?? { rate: 0, symbol: "" };
                  const th = rangeDays.reduce((s, d) => s + (hoursGrid[uid]?.[d] ?? 0), 0);
                  const pay = th * rate;
                  return (
                    <td key={uid} style={{ ...cell, fontWeight: 700, color: pay > 0 ? "var(--gold)" : "var(--muted)" }}>
                      {pay > 0 ? `${symbol}${formatAmount(pay)}` : "—"}
                    </td>
                  );
                })}
                {(() => {
                  const grandPay = visibleMembers.reduce((s, [uid]) => {
                    const { rate } = rateData[uid] ?? { rate: 0 };
                    const th = rangeDays.reduce((ss, d) => ss + (hoursGrid[uid]?.[d] ?? 0), 0);
                    return s + th * rate;
                  }, 0);
                  const sym = visibleMembers.map(([uid]) => rateData[uid]?.symbol).find(Boolean) ?? "";
                  return (
                    <td style={{ ...cell, fontWeight: 800, color: grandPay > 0 ? "var(--gold)" : "var(--muted)" }}>
                      {grandPay > 0 ? `${sym}${formatAmount(grandPay)}` : "—"}
                    </td>
                  );
                })()}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
