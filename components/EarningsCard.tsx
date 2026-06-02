"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Job, Entry } from "../lib/types";
import { getCurrencyByCode } from "../lib/currencies";
import { formatAmount } from "../lib/utils";

interface Props {
  jobs: Job[];
  entries: Entry[];
  hidden: boolean;
  onToggleHidden: () => void;
  onAddJob?: () => void;
  onLogSession?: (job: Job) => void;
}

interface JobEarningsGroup {
  job: Job;
  code: string;
  symbol: string;
  total: number;
  hours: number;
  sessions: number;
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function EarningsCard({ jobs, entries, hidden, onToggleHidden, onAddJob, onLogSession }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const groups: JobEarningsGroup[] = useMemo(() => {
    const map = new Map<string, JobEarningsGroup>();

    for (const job of jobs) {
      const info = getCurrencyByCode(job.cur);
      map.set(job.id, {
        job,
        code: job.cur,
        symbol: job.curSymbol || info.symbol,
        total: 0,
        hours: 0,
        sessions: 0,
      });
    }

    for (const entry of entries) {
      if (entry.status !== "approved") continue;
      const group = map.get(entry.jobId);
      if (!group) continue;

      group.total += entry.amount ?? (entry.hours * (entry.rate ?? 0));
      group.hours += entry.hours;
      group.sessions += 1;
    }

    return Array.from(map.values());
  }, [jobs, entries]);

  const slideCount = groups.length + 1;
  const activeGroup = activeIndex < groups.length ? groups[activeIndex] : null;

  useEffect(() => {
    if (activeIndex > slideCount - 1) {
      setActiveIndex(Math.max(slideCount - 1, 0));
    }
  }, [activeIndex, slideCount]);

  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;

    const nextIndex = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.min(Math.max(nextIndex, 0), slideCount - 1));
  }

  return (
    <div className="earnings-card">
      <div className="earnings-card-top">
        <span className="earnings-card-label">Personal Ledger</span>
        <button className="eye-btn" onClick={onToggleHidden} title={hidden ? "Show earnings" : "Hide earnings"}>
          <EyeIcon open={!hidden} />
        </button>
      </div>

      <div className="earnings-carousel" ref={carouselRef} onScroll={handleCarouselScroll}>
        {groups.map((group, index) => {
          return (
            <section key={group.job.id} className="earnings-slide" aria-label={`${group.job.name} earnings`}>
              <div className="job-earnings-slide-content">
                <div className="job-earnings-kicker">
                  <span>{group.job.name}</span>
                  <span>{index + 1} / {slideCount}</span>
                </div>

                <div className="cur-group">
                  <div className="cur-group-top">
                    <div className="cur-group-value">
                      <span className="cur-group-symbol">{group.symbol}</span>
                      <span className={`cur-group-amount${hidden ? " earnings-hidden" : ""}`}>
                        {formatAmount(group.total)}
                      </span>
                    </div>
                    <span className="job-earnings-code">{group.code}</span>
                  </div>
                </div>

                <div className="earnings-action-row">
                  <span className={`cur-group-meta${hidden ? " earnings-hidden" : ""}`}>
                    {group.sessions === 0
                      ? "No approved sessions yet"
                      : `${group.sessions} session${group.sessions !== 1 ? "s" : ""} - ${+group.hours.toFixed(3)} hrs`}
                  </span>
                  <button
                    type="button"
                    className="log-session-pill"
                    onClick={() => { if (onLogSession) onLogSession(group.job); }}
                  >
                    + Log Session
                  </button>
                </div>
              </div>
            </section>
          );
        })}

        <section className="earnings-slide" aria-label="Add a new job">
          <button type="button" className="add-job-slide" onClick={onAddJob}>
            <span className="add-job-slide-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </span>
            <span className="add-job-slide-title">Add a New Job</span>
            <span className="add-job-slide-copy">Create another job to track its earnings separately.</span>
          </button>
        </section>
      </div>

      <div className="earnings-dots" aria-hidden="true">
        {Array.from({ length: slideCount }).map((_, index) => (
          <span key={index} className={index === activeIndex ? "active" : ""} />
        ))}
      </div>

      {activeGroup && (
        <div className="ledger-stat-row">
          <div>
            <span>Hours</span>
            <strong className={hidden ? "earnings-hidden" : ""}>{activeGroup.hours.toFixed(1)}</strong>
          </div>
          <div>
            <span>Sessions</span>
            <strong>{activeGroup.sessions}</strong>
          </div>
          <div>
            <span>Jobs</span>
            <strong>{jobs.length}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
