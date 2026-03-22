"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "../../../lib/AuthContext";
import { getTeamByInviteCode, joinTeam } from "../../../lib/firestoreService";
import type { Team } from "../../../lib/types";

export default function JoinPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = params?.code ?? "";
  const { user, userProfile, loading, refreshProfile } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [fetching, setFetching] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  // Always store the invite code so auth can redirect back here after sign-in
  useEffect(() => {
    if (code) {
      try { sessionStorage.setItem("rl-join-code", code); } catch { /* ignore */ }
    }
  }, [code]);

  // Look up the team once auth state is resolved (rules may require auth)
  useEffect(() => {
    if (loading || !code) return;
    setFetching(true);
    getTeamByInviteCode(code)
      .then((t) => setTeam(t))
      .catch(() => { /* rules may block unauthenticated reads — handled in UI */ })
      .finally(() => setFetching(false));
  }, [code, loading]);

  // Skip join screen if user is already a member
  useEffect(() => {
    if (!loading && user && team && team.members[user.uid]) {
      try { sessionStorage.removeItem("rl-join-code"); } catch { /* ignore */ }
      router.replace("/dashboard");
    }
  }, [loading, user, team, router]);

  async function handleJoin() {
    if (!user || !team || !userProfile) return;
    setJoining(true);
    setError("");
    try {
      await joinTeam(team.id, user.uid, userProfile.name);
      await refreshProfile();
      try { sessionStorage.removeItem("rl-join-code"); } catch { /* ignore */ }
      router.replace("/dashboard");
    } catch {
      setError("Failed to join team. Please try again.");
      setJoining(false);
    }
  }

  function handleSignIn() {
    // Code already stored in sessionStorage — auth page will redirect back here
    router.push("/auth?type=personal");
  }

  if (loading || fetching) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  // Team not found (invalid code, or unauthenticated and rules block the read)
  if (!team) {
    return (
      <div className="splash-page">
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div className="brand-logo" style={{ width: 64, height: 64, borderRadius: 18, fontSize: 24, margin: "0 auto 20px" }}>
            R
          </div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 400, marginBottom: 12 }}>
            {user ? "Invalid invite link" : "You've been invited"}
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
            {user
              ? "This link is invalid or has expired. Ask your team admin for a new one."
              : "Sign in to RateLog to view your team invitation and join."}
          </p>
          {!user && (
            <button className="btn btn-primary btn-lg" style={{ maxWidth: 280, margin: "0 auto 12px" }} onClick={handleSignIn}>
              Sign in to continue
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ maxWidth: 280, margin: "0 auto", display: "block" }}
            onClick={() => router.push("/")}
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  const initial = team.name.charAt(0).toUpperCase();
  const memberCount = Object.keys(team.members).length;

  return (
    <div className="splash-page">
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div className="brand-logo" style={{ width: 72, height: 72, borderRadius: 20, fontSize: 28, margin: "0 auto 20px" }}>
          {initial}
        </div>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 400, marginBottom: 10 }}>
          Join <em style={{ color: "var(--gold)", fontStyle: "italic" }}>{team.name}</em>
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
          You&apos;ve been invited to join this team.
          {memberCount > 0 && ` ${memberCount} member${memberCount !== 1 ? "s" : ""} already on board.`}
        </p>

        {error && <div className="message message-error" style={{ marginBottom: 16 }}>{error}</div>}

        {user ? (
          <button
            className="btn btn-primary btn-lg"
            style={{ maxWidth: 300, margin: "0 auto" }}
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? "Joining…" : `Join ${team.name}`}
          </button>
        ) : (
          <button
            className="btn btn-primary btn-lg"
            style={{ maxWidth: 300, margin: "0 auto" }}
            onClick={handleSignIn}
          >
            Sign in to join
          </button>
        )}
      </div>
    </div>
  );
}
