"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, provider } from "../../lib/firebase";
import { useAuth } from "../../lib/AuthContext";
import { getUserProfile } from "../../lib/firestoreService";
import { cleanFirebaseError } from "../../lib/utils";

function PersonIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function TeamIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
      <circle cx="17" cy="8" r="3" />
      <path d="M22 20c0-3-2.5-5.2-5.5-5.5" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function AuthInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [type, setType] = useState<"personal" | "team">("personal");
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const p = params.get("type");
    if (p === "team" || p === "personal") {
      setType(p);
    } else {
      try {
        const stored = sessionStorage.getItem("rl-user-type");
        if (stored === "team" || stored === "personal") setType(stored);
      } catch { /* ignore */ }
    }
  }, [params]);

  // If already logged in, redirect appropriately
  useEffect(() => {
    if (user) handlePostAuth(user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handlePostAuth(uid: string) {
    await refreshProfile();
    // If the user arrived via an invite link, return them to complete the join
    try {
      const joinCode = sessionStorage.getItem("rl-join-code");
      if (joinCode) {
        router.replace(`/join/${joinCode}`);
        return;
      }
    } catch { /* ignore */ }
    const profile = await getUserProfile(uid);
    if (profile) {
      router.replace(profile.type === "team" ? "/team" : "/dashboard");
    } else {
      router.replace(type === "team" ? "/onboarding/team" : "/onboarding/personal");
    }
  }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      const result = await signInWithPopup(auth, provider);
      await handlePostAuth(result.user.uid);
    } catch (e: unknown) {
      setError(cleanFirebaseError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const fn = mode === "signUp" ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      const result = await fn(auth, email.trim(), password);
      await handlePostAuth(result.user.uid);
    } catch (e: unknown) {
      setError(cleanFirebaseError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page" style={{ position: "relative" }}>
      <button className="auth-back" onClick={() => router.push("/select")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div className={`auth-split${mounted ? " auth-split-mounted" : ""}`}>
        {/* Left panel — chosen type card */}
        <div className="auth-left">
          <div className="auth-left-card">
            <div className="auth-left-icon">
              {type === "team" ? <TeamIcon size={40} /> : <PersonIcon size={40} />}
            </div>
            <div>
              <div className="auth-left-label">{type === "team" ? "Team" : "Personal"}</div>
              <div className="auth-left-desc">
                {type === "team"
                  ? "Create a team, invite members, and approve sessions."
                  : "Track your own hours, rates, and earnings."}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — auth form */}
        <div className="auth-right">
          <div className="auth-form-wrap">
            <div className="auth-form-title">
              {mode === "signIn" ? "Welcome back" : "Create account"}
            </div>
            <div className="auth-form-sub">
              {mode === "signIn"
                ? "Sign in to continue to RateLog"
                : `Sign up as a ${type} user`}
            </div>

            {error && <div className="message message-error">{error}</div>}

            <button className="google-btn" onClick={handleGoogle} disabled={busy} type="button">
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="auth-divider">or</div>

            <form className="form" onSubmit={handleEmail}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder={mode === "signUp" ? "Minimum 6 characters" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={busy}
              >
                {busy ? "Please wait…" : mode === "signIn" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="auth-toggle">
              {mode === "signIn" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button onClick={() => { setMode("signUp"); setError(""); }}>Sign up</button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button onClick={() => { setMode("signIn"); setError(""); }}>Sign in</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
      <AuthInner />
    </Suspense>
  );
}
