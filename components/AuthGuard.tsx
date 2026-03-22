"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";

interface Props {
  children: ReactNode;
  /** If set, redirect here instead of "/" when not authenticated. */
  redirectTo?: string;
}

export default function AuthGuard({ children, redirectTo = "/" }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(redirectTo);
    }
  }, [loading, user, redirectTo, router]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
