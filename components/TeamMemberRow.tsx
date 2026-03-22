"use client";
import type { TeamMember } from "../lib/types";

interface Props {
  uid: string;
  member: TeamMember;
  sessionCount?: number;
}

export default function TeamMemberRow({ uid: _uid, member, sessionCount = 0 }: Props) {
  const initial = member.name ? member.name.charAt(0).toUpperCase() : "?";

  const joinedDate =
    member.joinedAt && typeof member.joinedAt.toDate === "function"
      ? member.joinedAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";

  return (
    <div className="member-row">
      <div className="member-avatar">{initial}</div>
      <div style={{ flex: 1 }}>
        <div className="member-name">{member.name}</div>
        <div className="member-meta">Joined {joinedDate}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{sessionCount}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>session{sessionCount !== 1 ? "s" : ""}</div>
      </div>
    </div>
  );
}
