"use client";
import { useState, useMemo } from "react";
import type { Entry, Job, TeamMember } from "../lib/types";
import { formatHours, formatAmount } from "../lib/utils";

interface Props {
  allEntries: Entry[];
  members: Record<string, TeamMember>;
  jobs: Job[];
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toDateStr(d);
  });
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const cell: React.CSSProperties = {
  padding: "9px 10px",
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const navBtn: React.CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "6px 16px",
  cursor: "pointer",
  color: "var(--text)",
  fontSize: 16,
  lineHeight: 1,
};

export default function TeamWeeklyTimesheet({ allEntries, members, jobs }: Props) {
  const [weekStart, setWeekStart] = useState<string>(() =>
    toDateStr(getMondayOf(new Date()))
  );

  const weekDays = useMemo(
    () => getWeekDays(new Date(weekStart + "T00:00:00")),
    [weekStart]
  );

  const memberList = useMemo(() => Object.entries(members), [members]);

  const weekLabel = useMemo(() => {
    const s = new Date(weekDays[0] + "T00:00:00");
    const e = new Date(weekDays[6] + "T00:00:00");
    const sStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const eStr = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${sStr} – ${eStr}`;
  }, [weekDays]);

  const weekEntries = useMemo(
    () => allEntries.filter((e) => weekDays.includes(e.date)),
    [allEntries, weekDays]
  );

  // hours[uid][dateStr] = total hours logged that day
  const hoursGrid = useMemo(() => {
    const grid: Record<string, Record<string, number>> = {};
    memberList.forEach(([uid]) => { grid[uid] = {}; });
    weekEntries.forEach((e) => {
      if (!grid[e.workerUid]) return;
      grid[e.workerUid][e.date] = (grid[e.workerUid][e.date] ?? 0) + e.hours;
    });
    return grid;
  }, [weekEntries, memberList]);

  // Effective rate per worker — uses all-time approved entries for stability
  const rateData = useMemo(() => {
    const result: Record<string, { rate: number; symbol: string }> = {};
    memberList.forEach(([uid]) => {
      const approvedAll = allEntries.filter(
        (e) => e.workerUid === uid && e.status === "approved" && (e.amount ?? 0) > 0 && e.hours > 0
      );
      let rate = 0;
      let symbol = "";
      if (approvedAll.length > 0) {
        // Most recent approved entry
        const recent = [...approvedAll].sort((a, b) => b.date.localeCompare(a.date))[0];
        rate = recent.rate ?? (recent.amount! / recent.hours);
        symbol = jobs.find((j) => j.id === recent.jobId)?.curSymbol ?? "";
      } else {
        // Fallback: defRate from the job this worker has most entries for
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
  }, [allEntries, memberList, jobs]);

  function prevWeek() {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() - 7);
    setWeekStart(toDateStr(d));
  }
  function nextWeek() {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 7);
    setWeekStart(toDateStr(d));
  }

  if (memberList.length === 0) {
    return <div className="empty-state"><p>No team members yet. Share your invite link to onboard people.</p></div>;
  }

  return (
    <div>
      {/* Week navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 8 }}>
        <button onClick={prevWeek} style={navBtn}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", textAlign: "center", flex: 1 }}>{weekLabel}</span>
        <button onClick={nextWeek} style={navBtn}>›</button>
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
            {/* Daily rows */}
            {weekDays.map((dateStr, i) => {
              const dayTotal = memberList.reduce((s, [uid]) => s + (hoursGrid[uid]?.[dateStr] ?? 0), 0);
              return (
                <tr key={dateStr} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  <td style={{ ...cell, textAlign: "left" }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{DAY_LABELS[i]}</span>
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

            {/* Weekly totals */}
            <tr>
              <td style={{ ...cell, textAlign: "left", fontWeight: 700, color: "var(--text)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Weekly
              </td>
              {memberList.map(([uid]) => {
                const total = weekDays.reduce((s, d) => s + (hoursGrid[uid]?.[d] ?? 0), 0);
                return (
                  <td key={uid} style={{ ...cell, fontWeight: 700 }}>
                    {total > 0 ? formatHours(total) : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                );
              })}
              {(() => {
                const grand = memberList.reduce((s, [uid]) => s + weekDays.reduce((ss, d) => ss + (hoursGrid[uid]?.[d] ?? 0), 0), 0);
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
                const wh = weekDays.reduce((s, d) => s + (hoursGrid[uid]?.[d] ?? 0), 0);
                const pay = wh * rate;
                return (
                  <td key={uid} style={{ ...cell, fontWeight: 700, color: pay > 0 ? "var(--gold)" : "var(--muted)" }}>
                    {pay > 0 ? `${symbol}${formatAmount(pay)}` : "—"}
                  </td>
                );
              })}
              {(() => {
                const grandPay = memberList.reduce((s, [uid]) => {
                  const { rate } = rateData[uid] ?? { rate: 0 };
                  const wh = weekDays.reduce((ss, d) => ss + (hoursGrid[uid]?.[d] ?? 0), 0);
                  return s + wh * rate;
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
