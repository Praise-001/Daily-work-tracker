"use client";
import { auth, signOut } from "../lib/firebase";
import { useMemo } from "react";

type Props = { userEmail?: string; onSignOut?: () => void };

export default function NavBar({ userEmail, onSignOut }: Props) {
  const initial = useMemo(
    () => (userEmail ? userEmail.charAt(0).toUpperCase() : "?"),
    [userEmail]
  );
  return (
    <nav className="nav">
      <div className="brand">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "linear-gradient(135deg,#f9c74f,#ef476f)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0b0b0b",
            fontWeight: 800
          }}
        >
          {initial}
        </div>
        <div>
          Work Journal
          <div className="muted" style={{ fontSize: 12 }}>
            Track hours & approvals
          </div>
        </div>
      </div>
      <div className="toolbar">
        {userEmail && <span className="pill">{userEmail}</span>}
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await signOut(auth);
            onSignOut?.();
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
