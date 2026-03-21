"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";

function PersonIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
      <circle cx="17" cy="8" r="3" />
      <path d="M22 20c0-3-2.5-5.2-5.5-5.5" />
    </svg>
  );
}

export default function SelectPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && user && userProfile) {
      router.replace(userProfile.type === "team" ? "/team" : "/dashboard");
    }
  }, [loading, user, userProfile, router]);

  function choose(type: "personal" | "team") {
    try { sessionStorage.setItem("rl-user-type", type); } catch { /* ignore */ }
    router.push(`/auth?type=${type}`);
  }

  return (
    <div className={`select-page${mounted ? " select-mounted" : ""}`}>
      <h1 className="select-heading">How do you wish to continue?</h1>
      <div className="select-cards">
        <button className="type-card" onClick={() => choose("personal")}>
          <div className="type-card-icon">
            <PersonIcon />
          </div>
          <div className="type-card-label">Personal</div>
          <div className="type-card-desc">
            Track your own hours, rates, and earnings across multiple jobs.
          </div>
        </button>

        <button className="type-card" onClick={() => choose("team")}>
          <div className="type-card-icon">
            <TeamIcon />
          </div>
          <div className="type-card-label">Team</div>
          <div className="type-card-desc">
            Create a team, invite members, and manage and approve sessions.
          </div>
        </button>
      </div>
    </div>
  );
}
