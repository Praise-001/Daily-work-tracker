"use client";
import { ReactNode } from "react";

type Props = {
  title: string;
  currency: string;
  earned: number;
  hours: number;
  sessions: number;
  cta?: ReactNode;
};

export function JobCard({ title, currency, earned, hours, sessions, cta }: Props) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="muted">{currency}</div>
      <div className="stat" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <div>
          <strong>{currency}{earned.toFixed(2)}</strong>
          <span className="muted">Earned</span>
        </div>
        <div>
          <strong>{+hours.toFixed(3)}h</strong>
          <span className="muted">Hours</span>
        </div>
        <div>
          <strong>{sessions}</strong>
          <span className="muted">Sessions</span>
        </div>
      </div>
      {cta && <div style={{ marginTop: 12 }}>{cta}</div>}
    </div>
  );
}
