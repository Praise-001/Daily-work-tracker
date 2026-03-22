"use client";
type Entry = {
  id: string;
  jobName: string;
  date: string;
  hours: number;
  rate: number;
  status?: string;
  note?: string;
};

export function SessionList({ entries }: { entries: Entry[] }) {
  if (!entries.length) {
    return <div className="empty">No sessions yet. Log your first one!</div>;
  }
  return (
    <ul className="list">
      {entries.map((e) => (
        <li key={e.id}>
          <div>
            <div style={{ fontWeight: 600 }}>{e.jobName}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {e.date} • {e.hours}h @ {e.rate}/hr {e.note ? "• " + e.note : ""}
            </div>
          </div>
          <span className="badge">{e.status || "pending"}</span>
        </li>
      ))}
    </ul>
  );
}
