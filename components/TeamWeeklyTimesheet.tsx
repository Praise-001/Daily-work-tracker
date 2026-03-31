"use client";
import { useState, useMemo } from "react";
import type { Entry, Job, TeamMember } from "../lib/types";
import { formatHours, formatAmount } from "../lib/utils";

interface Props {
  allEntries: Entry[];
  members: Record<string, TeamMember>;
  jobs: Job[];
  adminUid?: string;
  adminName?: string;
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

export default function TeamWeeklyTimesheet({ allEntries, members, jobs, adminUid, adminName }: Props) {
  const monday = getMondayStr();
  const [startDate, setStartDate] = useState<string>(monday);
  const [endDate, setEndDate] = useState<string>(getSundayStr(monday));
  const [selectedJobId, setSelectedJobId] = useState<string>("all");

  const rangeDays = useMemo(() => getRangeDays(startDate, endDate), [startDate, endDate]);

  const memberList = useMemo(() => {
    const list = Object.entries(members);
    if (adminUid && adminName) {
      return [[adminUid, { name: adminName } as TeamMember], ...list] as [string, TeamMember][];
    }
    return list;
  }, [members, adminUid, adminName]);

  // Filter entries by date range and optionally by job
  const filteredEntries = useMemo(() => {
    return allEntries.filter((e) => {
      const inRange = rangeDays.includes(e.date);
      const inJob = selectedJobId === "all" || e.jobId === selectedJobId;
      return inRange && inJob;
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

  if (memberList.length === 0) {
    return <div className="empty-state"><p>No team members yet. Share your invite link to onboard people.</p></div>;
  }

  const rangeCount = rangeDays.length;

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>

        {/* Job filter */}
        {jobs.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>Job</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSelectedJobId("all")}
                style={{
                  padding: "5px 12px", fontSize: 12, borderRadius: 99, cursor: "pointer",
                  background: selectedJobId === "all" ? "var(--gold)" : "var(--surface2)",
                  color: selectedJobId === "all" ? "#0d0d0d" : "var(--muted)",
                  border: selectedJobId === "all" ? "none" : "1px solid var(--border)",
                  fontWeight: selectedJobId === "all" ? 600 : 400,
                }}
              >
                All Jobs
              </button>
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  style={{
                    padding: "5px 12px", fontSize: 12, borderRadius: 99, cursor: "pointer",
                    background: selectedJobId === job.id ? "var(--gold)" : "var(--surface2)",
                    color: selectedJobId === job.id ? "#0d0d0d" : "var(--muted)",
                    border: selectedJobId === job.id ? "none" : "1px solid var(--border)",
                    fontWeight: selectedJobId === job.id ? 600 : 400,
                  }}
                >
                  {job.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date range */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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
        </div>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
          <thead>
            <tr style={{ background: "var(--surface2)" }}>
              <th style={{ ...cell, textAlign: "left", color: "var(--muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", minWidth: 72 }}>
                Day
              </th>
              {memberList.map(([uid, member]) => (
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
              const dayTotal = memberList.reduce((s, [uid]) => s + (hoursGrid[uid]?.[dateStr] ?? 0), 0);
              return (
                <tr key={dateStr} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  <td style={{ ...cell, textAlign: "left" }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{dayLabel(dateStr)}</span>
                    <br />
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>{shortDate(dateStr)}</span>
                  </td>
                  {memberList.map(([uid]) => {
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
              );
            })}

            {/* Separator */}
            <tr>
              <td colSpan={memberList.length + 2} style={{ padding: 0, height: 2, background: "var(--border2)" }} />
            </tr>

            {/* Total hours */}
            <tr>
              <td style={{ ...cell, textAlign: "left", fontWeight: 700, color: "var(--text)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Total
              </td>
              {memberList.map(([uid]) => {
                const total = rangeDays.reduce((s, d) => s + (hoursGrid[uid]?.[d] ?? 0), 0);
                return (
                  <td key={uid} style={{ ...cell, fontWeight: 700 }}>
                    {total > 0 ? formatHours(total) : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                );
              })}
              {(() => {
                const grand = memberList.reduce((s, [uid]) => s + rangeDays.reduce((ss, d) => ss + (hoursGrid[uid]?.[d] ?? 0), 0), 0);
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
              {memberList.map(([uid]) => {
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
              {memberList.map(([uid]) => {
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
                const grandPay = memberList.reduce((s, [uid]) => {
                  const { rate } = rateData[uid] ?? { rate: 0 };
                  const th = rangeDays.reduce((ss, d) => ss + (hoursGrid[uid]?.[d] ?? 0), 0);
                  return s + th * rate;
                }, 0);
                const sym = memberList.map(([uid]) => rateData[uid]?.symbol).find(Boolean) ?? "";
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
  );
}
