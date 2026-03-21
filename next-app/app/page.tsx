"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";

export default function SplashPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && user && userProfile) {
      router.replace(userProfile.type === "team" ? "/team" : "/dashboard");
    }
  }, [loading, user, userProfile, router]);

  return (
    <div className={`splash-page${mounted ? " splash-mounted" : ""}`}>
      <div>
        <h1 className="splash-title">
          Welcome to <em>RateLog</em>
        </h1>
        <p className="splash-subtitle">Track your hours. Know your worth.</p>
      </div>
      <button className="splash-cta" onClick={() => router.push("/select")}>
        Click to continue
      </button>
    </div>
  );
}
